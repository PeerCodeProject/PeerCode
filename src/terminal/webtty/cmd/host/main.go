package main

import (
	"flag"
	"fmt"
	"github.com/maxmcd/webtty/pkg/host"
	"log"
	"os"
)

func main() {
	_ = flag.Bool("cmd", false, "The command to run. Default is \"bash -l\"\n"+
		"Because this flag consumes the remainder of the command line,\n"+
		"all other args (if present) must appear before this flag.\n"+
		"eg: webtty -o -v -ni -cmd docker run -it --rm alpine:latest sh")
	stunServer := flag.String("s", "stun:stun.l.google.com:19302", "The stun server to use")

	cmd := []string{"bash", "-l"}
	for i, arg := range os.Args {
		if arg == "-cmd" {
			cmd = os.Args[i+1:]
			os.Args = os.Args[:i]
		}
	}
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	var err error

	hc := host.HostSession{
		OneWay:         false,
		Cmd:            cmd,
		NonInteractive: false,
	}
	hc.StunServers = []string{*stunServer}
	err = hc.Run()

	if err != nil {
		fmt.Printf("Quitting with an unexpected error: \"%s\"\n", err)
	}
}
