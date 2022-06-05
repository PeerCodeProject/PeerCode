package main

import (
	"bufio"
	"flag"
	"fmt"
	"github.com/maxmcd/webtty/pkg/client"
	"log"
	"os"
)

func main() {

	_ = flag.Bool("cmd", false, "The command to run. Default is \"bash -l\"\n"+
		"Because this flag consumes the remainder of the command line,\n"+
		"all other args (if present) must appear before this flag.\n"+
		"eg: webtty -o -v -ni -cmd docker run -it --rm alpine:latest sh")
	stunServer := flag.String("s", "stun:stun.l.google.com:19302", "The stun server to use")

	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	args := flag.Args()
	var offerString string
	if len(args) > 0 {
		offerString = args[len(args)-1]
	}

	var err error
	// read offer from file if it exists
	if offerString == "" {
		filename := "../tmp/webrtc.sdp"
		if _, err := os.Stat(filename); err == nil {
			file, err := os.Open(filename)
			if err != nil {
				return
			}
			defer file.Close()
			scanner := bufio.NewScanner(file)
			for scanner.Scan() {
				offerString = scanner.Text()
			}
		}
		if err != nil {
			log.Fatal(err)
		}
	}
	cc := client.ClientSession{
		OfferString: offerString,
	}
	cc.StunServers = []string{*stunServer}
	err = cc.Run()
	if err != nil {
		fmt.Printf("Quitting with an unexpected error: \"%s\"\n", err)
	}
}
