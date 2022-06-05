package host

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"time"

	"github.com/creack/pty"
	"github.com/maxmcd/webtty/pkg"
	"github.com/maxmcd/webtty/pkg/sd"

	"github.com/maxmcd/webtty/pkg/session"
	"github.com/mitchellh/colorstring"
	"github.com/pion/webrtc/v3"
)

type HostSession struct {
	session.Session
	Cmd            []string
	NonInteractive bool
	OneWay         bool
	ptmx           *os.File
	ptmxReady      bool
	tmux           bool
}

func (hs *HostSession) dataChannelOnOpen() func() {
	return func() {
		colorstring.Println("[bold]Terminal session started:")
		log.Print(hs.Cmd)
		cmd := exec.Command(hs.Cmd[0], hs.Cmd[1:]...)
		var err error
		hs.ptmx, err = pty.Start(cmd)
		if err != nil {
			log.Println(err)
			hs.ErrChan <- err
			return
		}
		hs.ptmxReady = true

		log.Print(hs.NonInteractive)
		if !hs.NonInteractive {
			log.Println("make raw terminal")
			if err = hs.MakeRawTerminal(); err != nil {
				log.Println(err)
				hs.ErrChan <- err
				return
			}
			go func() {
				if _, err = io.Copy(hs.ptmx, os.Stdin); err != nil {
					log.Println(err)
				}
			}()
		}

		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt)
		go func() {
			for range c {
				log.Println("Sigint")
				hs.ErrChan <- errors.New("sigint")
			}
		}()

		buf := make([]byte, 1024)
		for {
			nr, err := hs.ptmx.Read(buf)
			if err != nil {
				if err == io.EOF {
					err = nil
				} else {
					log.Println(err)
				}
				hs.ErrChan <- err
				return
			}
			if !hs.NonInteractive {
				if _, err = os.Stdout.Write(buf[0:nr]); err != nil {
					log.Println(err)
					hs.ErrChan <- err
					return
				}
			}
			if err = hs.Dc.Send(buf[0:nr]); err != nil {
				log.Println(err)
				hs.ErrChan <- err
				return
			}
		}
	}
}

func (hs *HostSession) dataChannelOnMessage() func(payload webrtc.DataChannelMessage) {
	return func(p webrtc.DataChannelMessage) {

		// OnMessage can fire before onOpen
		// Let's wait for the pty session to be ready
		for hs.ptmxReady != true {
			time.Sleep(1 * time.Millisecond)
		}

		if p.IsString {
			if len(p.Data) > 2 && p.Data[0] == '[' && p.Data[1] == '"' {
				var msg []string
				err := json.Unmarshal(p.Data, &msg)
				if len(msg) == 0 {
					log.Println(err)
					hs.ErrChan <- err
				}
				if msg[0] == "stdin" {
					toWrite := []byte(msg[1])
					if len(toWrite) == 0 {
						return
					}
					_, err := hs.ptmx.Write([]byte(msg[1]))
					if err != nil {
						log.Println(err)
						hs.ErrChan <- err
					}
					return
				}
				if msg[0] == "set_size" {
					var size []int
					_ = json.Unmarshal(p.Data, &size)
					ws, err := pty.GetsizeFull(hs.ptmx)
					if err != nil {
						log.Println(err)
						hs.ErrChan <- err
						return
					}
					ws.Rows = uint16(size[1])
					ws.Cols = uint16(size[2])

					if len(size) >= 5 {
						ws.X = uint16(size[3])
						ws.Y = uint16(size[4])
					}

					if err := pty.Setsize(hs.ptmx, ws); err != nil {
						log.Println(err)
						hs.ErrChan <- err
					}
					return
				}
			}
			if string(p.Data) == "quit" {
				hs.ErrChan <- nil
				return
			}
			hs.ErrChan <- fmt.Errorf(
				`Unmatched string message: "%s"`,
				string(p.Data),
			)
		} else {
			_, err := hs.ptmx.Write(p.Data)
			if err != nil {
				log.Println(err)
				hs.ErrChan <- err
			}
		}
	}
}

func (hs *HostSession) onDataChannel() func(Dc *webrtc.DataChannel) {
	return func(Dc *webrtc.DataChannel) {
		hs.Dc = Dc
		Dc.OnOpen(hs.dataChannelOnOpen())
		Dc.OnMessage(hs.dataChannelOnMessage())
	}
}

func (hs *HostSession) mustReadStdin() (string, error) {
	var input string
	fmt.Scanln(&input)
	// read from file if input is a file
	if _, err := os.Stat(input); err == nil {
		file, err := os.Open(input)
		if err != nil {
			return "", err
		}
		defer file.Close()
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			input = scanner.Text()
		}
	}
	sd, err := sd.Decode(input)
	return sd.Sdp, err
}

func (hs *HostSession) createOffer() (err error) {
	hs.Pc.OnDataChannel(hs.onDataChannel())

	// Create unused DataChannel, the Offer doesn't implictly have
	// any media sections otherwise
	if _, err = hs.Pc.CreateDataChannel("offerer-channel", nil); err != nil {
		log.Println(err)
		return
	}

	// Create an Offer to send to the browser
	Offer, err := hs.Pc.CreateOffer(nil)
	if err != nil {
		log.Println(err)
		return
	}

	// Create channel that is blocked until ICE Gathering is complete
	gatherComplete := webrtc.GatheringCompletePromise(hs.Pc)

	err = hs.Pc.SetLocalDescription(Offer)
	if err != nil {
		log.Println(err)
		return
	}

	// Block until ICE Gathering is complete
	<-gatherComplete

	hs.Offer = sd.SessionDescription{
		Sdp: hs.Pc.LocalDescription().SDP,
	}
	if hs.OneWay {
		hs.Offer.GenKeys()
		hs.Offer.Encrypt()
		hs.Offer.TenKbSiteLoc = pkg.RandSeq(100)
	}
	return
}

func (hs *HostSession) Run() (err error) {
	if err = hs.Init(); err != nil {
		return
	}
	colorstring.Printf("[bold]Setting up a WebTTY connection.\n\n")
	if hs.OneWay {
		colorstring.Printf(
			"Warning: One-way connections rely on a third party to connect. " +
				"More info here: https://github.com/maxmcd/webtty#one-way-connections\n\n")
	}

	if err = hs.createOffer(); err != nil {
		return
	}

	// Output the Offer in base64 so we can paste it in browser
	colorstring.Printf("[bold]Connection ready. Here is your connection data:\n\n")
	encoded := sd.Encode(hs.Offer)

	fmt.Printf("%s\n\n", encoded)
	colorstring.Printf(`[bold]Paste it in the terminal after the webtty command` +
		"\n[bold]Or in a browser: [reset]https://maxmcd.github.io/webtty/\n\n")

	if hs.OneWay == false {
		colorstring.Println("[bold]When you have the Answer, paste it below and hit enter:")
		// Wait for the Answer to be pasted
		hs.Answer.Sdp, err = hs.mustReadStdin()
		if err != nil {
			log.Println(err)
			return
		}
		fmt.Println("Answer recieved, connecting...")
	} else {
		body, err := pkg.PollForResponse(hs.Offer.TenKbSiteLoc)
		if err != nil {
			log.Println(err)
			return err
		}
		hs.Answer, err = sd.Decode(body)
		if err != nil {
			log.Println(err)
			return err
		}
		hs.Answer.Key = hs.Offer.Key
		hs.Answer.Nonce = hs.Offer.Nonce
		if err = hs.Answer.Decrypt(); err != nil {
			return err
		}
	}
	return hs.setHostRemoteDescriptionAndWait()
}

func (hs *HostSession) setHostRemoteDescriptionAndWait() (err error) {
	// Set the remote SessionDescription
	Answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  hs.Answer.Sdp,
	}

	// Apply the Answer as the remote description
	if err = hs.Pc.SetRemoteDescription(Answer); err != nil {
		log.Println(err)
		return
	}

	// Wait to quit
	err = <-hs.ErrChan
	hs.Cleanup()
	return
}
