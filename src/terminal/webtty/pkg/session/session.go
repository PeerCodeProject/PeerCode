package session

import (
	"log"
	"os"

	"github.com/maxmcd/webtty/pkg/sd"
	"github.com/pion/webrtc/v3"
	"golang.org/x/term"
)

type Session struct {
	// mutex?
	OldTerminalState *term.State
	StunServers      []string
	ErrChan          chan error
	IsTerminal       bool
	Pc               *webrtc.PeerConnection
	Offer            sd.SessionDescription
	Answer           sd.SessionDescription
	Dc               *webrtc.DataChannel
}

func (s *Session) Init() (err error) {
	s.ErrChan = make(chan error, 1)
	s.IsTerminal = term.IsTerminal(int(os.Stdin.Fd()))
	if err = s.CreatePeerConnection(); err != nil {
		log.Println(err)
		return
	}
	return
}

func (s *Session) Cleanup() {
	if s.Dc != nil {
		// TODO: check dc state?
		if err := s.Dc.SendText("quit"); err != nil {
			log.Println(err)
		}
	}
	if s.IsTerminal {
		if err := s.RestoreTerminalState(); err != nil {
			log.Println(err)
		}
	}

}

func (s *Session) RestoreTerminalState() error {
	if s.OldTerminalState != nil {
		return term.Restore(int(os.Stdin.Fd()), s.OldTerminalState)
	}
	return nil
}

func (s *Session) MakeRawTerminal() error {
	var err error
	s.OldTerminalState, err = term.MakeRaw(int(os.Stdin.Fd()))
	return err
}

func (s *Session) CreatePeerConnection() (err error) {
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: s.StunServers,
			},
		},
	}
	s.Pc, err = webrtc.NewPeerConnection(config)
	if err != nil {
		return
	}
	// fmt.Println(s.pc)
	// fmt.Println(s.pc.SignalingState)
	// fmt.Println(s.pc.ConnectionState)

	// if s.pc.OnDataChannel == nil {
	// 	return errors.New("Couldn't create a peerConnection")
	// }
	s.Pc.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		log.Printf("ICE Connection State has changed: %s\n", connectionState.String())
	})
	return
}
