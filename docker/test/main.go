package main

import "fmt"
import "docker"

func main() {
	imagename := "test-python"
	dockerFilePath := "C:\\Users\\vanik\\Desktop\\peercode-project\\peercode\\docker\\tmp\\Dockerfile"
	result := docker.BuildAndRun(imagename, dockerFilePath)
	fmt.Println(result)
}
