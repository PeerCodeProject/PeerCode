package main

import (
	"docker/core"
	"log"
	"syscall/js"
)

func BuildAndRunDocker(this js.Value, args []js.Value) interface{} {
	log.Println("BuildAndRunDocker", this, args)
	if len(args) != 2 {
		return "Invalid no of arguments passed"
	}
	return core.BuildAndRun(args[0].String(), args[1].String())
}

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("BuildAndRunDocker", js.FuncOf(BuildAndRunDocker))

	<-c
}
