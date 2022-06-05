package client

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/creack/pty"
	"github.com/maxmcd/webtty/pkg"
	"github.com/maxmcd/webtty/pkg/sd"
	"github.com/maxmcd/webtty/pkg/session"
	"github.com/mitchellh/colorstring"
	"github.com/pion/webrtc/v3"
	"golang.org/x/crypto/ssh/terminal"
)

type ClientSession struct {
	session.Session
	Dc          *webrtc.DataChannel
	OfferString string
}

func sendTermSize(term *os.File, dcSend func(s string) error) error {
	winSize, err := pty.GetsizeFull(term)
	if err != nil {
		log.Fatal(err)
	}
	size := fmt.Sprintf(`["set_size",%d,%d,%d,%d]`,
		winSize.Rows, winSize.Cols, winSize.X, winSize.Y)

	return dcSend(size)
}

func (cs *ClientSession) dataChannelOnOpen() func() {
	return func() {
		log.Printf("Data channel '%s'-'%d'='%d' open.\n", cs.Dc.Label(), cs.Dc.ID(), cs.Dc.MaxPacketLifeTime())
		colorstring.Println("[bold]Terminal session started:")

		if err := cs.MakeRawTerminal(); err != nil {
			log.Println(err)
			cs.ErrChan <- err
		}

		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGWINCH)
		go func() {
			for range ch {
				err := sendTermSize(os.Stdin, cs.Dc.SendText)
				if err != nil {
					log.Println(err)
					cs.ErrChan <- err
				}
			}
		}()
		ch <- syscall.SIGWINCH // Initial resize.
		buf := make([]byte, 1024)
		for {
			nr, err := os.Stdin.Read(buf)
			if err != nil {
				log.Println(err)
				cs.ErrChan <- err
			}
			err = cs.Dc.Send(buf[0:nr])
			if err != nil {
				log.Println(err)
				cs.ErrChan <- err
			}
		}
	}
}

func (cs *ClientSession) dataChannelOnMessage() func(payload webrtc.DataChannelMessage) {
	return func(p webrtc.DataChannelMessage) {
		if p.IsString {
			if string(p.Data) == "quit" {
				if cs.IsTerminal {
					terminal.Restore(int(os.Stdin.Fd()), cs.OldTerminalState)
				}
				cs.ErrChan <- nil
				return
			}
			cs.ErrChan <- fmt.Errorf(`Unmatched string message: "%s"`, string(p.Data))
		} else {
			f := bufio.NewWriter(os.Stdout)
			f.Write(p.Data)
			f.Flush()
		}
	}
}

func (cs *ClientSession) Run() (err error) {
	if err = cs.Init(); err != nil {
		return
	}

	maxPacketLifeTime := uint16(1000) // Arbitrary
	ordered := true
	if cs.Dc, err = cs.Pc.CreateDataChannel("data", &webrtc.DataChannelInit{
		Ordered:           &ordered,
		MaxPacketLifeTime: &maxPacketLifeTime,
	}); err != nil {
		log.Println(err)
		return
	}

	cs.Dc.OnOpen(cs.dataChannelOnOpen())
	cs.Dc.OnMessage(cs.dataChannelOnMessage())

	if cs.Offer, err = sd.Decode(cs.OfferString); err != nil {
		log.Println(err)
		return
	}
	if cs.Offer.Key != "" {
		if err = cs.Offer.Decrypt(); err != nil {
			log.Println(err)
			return
		}
	}
	Offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  cs.Offer.Sdp,
	}

	if err = cs.Pc.SetRemoteDescription(Offer); err != nil {
		log.Println(err)
		return err
	}
	// Sets the LocalDescription, and starts our UDP listeners
	answer, err := cs.Pc.CreateAnswer(nil)
	if err != nil {
		log.Println(err)
		return
	}

	// Create channel that is blocked until ICE Gathering is complete
	gatherComplete := webrtc.GatheringCompletePromise(cs.Pc)

	err = cs.Pc.SetLocalDescription(answer)
	if err != nil {
		log.Println(err)
		return
	}

	// Block until ICE Gathering is complete
	<-gatherComplete

	answerSd := sd.SessionDescription{
		Sdp:   cs.Pc.LocalDescription().SDP,
		Key:   cs.Offer.Key,
		Nonce: cs.Offer.Nonce,
	}
	if cs.Offer.Key != "" {
		// Encrypt with the shared keys from the Offer
		_ = answerSd.Encrypt()

		// Don't upload the keys, the host has them
		answerSd.Key = ""
		answerSd.Nonce = ""
	}

	encodedAnswer := sd.Encode(answerSd)
	if cs.Offer.TenKbSiteLoc == "" {
		fmt.Printf("Answer created. Send the following answer to the host:\n\n")
		fmt.Println(encodedAnswer)
		// write to file
		f, err := os.Create("../tmp/answer.sdp")
		if err != nil {
			log.Println(err)
			return
		}
		defer f.Close()
		f.WriteString(encodedAnswer)

	} else {
		if err := pkg.Create10kbFile(cs.Offer.TenKbSiteLoc, encodedAnswer); err != nil {
			return err
		}
	}
	err = <-cs.ErrChan
	cs.Cleanup()
	return err
}
