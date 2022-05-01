package core

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
)

type ErrorLine struct {
	Error       string      `json:"error"`
	ErrorDetail ErrorDetail `json:"errorDetail"`
}

type ErrorDetail struct {
	Message string `json:"message"`
}

func printReader(rd io.Reader) (error, []string) {
	var lastLine string
	logLines := make([]string, 0)
	scanner := bufio.NewScanner(rd)
	for scanner.Scan() {
		lastLine = scanner.Text()
		logLines = append(logLines, lastLine)
		//fmt.Println(scanner.Text())
	}

	errLine := &ErrorLine{}
	json.Unmarshal([]byte(lastLine), errLine)
	if errLine.Error != "" {
		return errors.New(errLine.Error), nil
	}

	if err := scanner.Err(); err != nil {
		return err, logLines
	}

	return nil, logLines
}
