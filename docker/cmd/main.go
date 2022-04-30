package main

import (
	"docker"
	"log"
	"syscall/js"
)

func BuildAndRunDocker(this js.Value, p []js.Value) interface{} {
	log.Println("BuildAndRunDocker", this, p)
	return docker.BuildAndRun(p[0], p[1])
}

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("BuildAndRunDocker", js.FuncOf(BuildAndRunDocker))

	<-c
}
