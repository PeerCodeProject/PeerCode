package main

import (
	"docker/core"
	"fmt"
)

func main() {
	imagename := "test-python"
	dockerFilePath := "C:\\Users\\vanik\\Desktop\\peercode-project\\peercode\\docker\\test\\tmp\\Dockerfile"
	result := core.BuildAndRun(imagename, dockerFilePath)
	fmt.Println(result)
}
