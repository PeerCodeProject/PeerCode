package core

import (
	"bytes"
	"context"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/archive"
	"github.com/mitchellh/go-homedir"
	"io"
	"log"
	"path/filepath"
)

type DockerClient struct {
	cli *client.Client
	ctx context.Context
}

type IDockerClient interface {
	BuildImage(dockerfile string, tag string) (error, io.Reader)
	CreateContainer(imageName string) (string, error)
	StartContainer(containerID string) (string, error)
	StopContainer(containerID string) error
	RemoveContainer(containerID string) error
	GetContainerLogs(containerID string) (string, error)
	Close()
}

func newDockerClient() (IDockerClient, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &DockerClient{
		cli: cli,
		ctx: context.Background(),
	}, nil
}

func (d *DockerClient) BuildImage(dockerFolder string, tag string) (error, io.Reader) {
	dir, dockerFile := filepath.Split(dockerFolder)
	ctx := GetContext(dir)

	buildOptions := types.ImageBuildOptions{
		Dockerfile: dockerFile,
		Tags:       []string{tag},
		Remove:     true,
		Context:    ctx,
	}
	buildResponse, err := d.cli.ImageBuild(d.ctx, ctx, buildOptions)
	return err, buildResponse.Body
}

func (d *DockerClient) CreateContainer(imageName string) (string, error) {
	config := &container.Config{
		Image: imageName,
	}
	containerResponse, err := d.cli.ContainerCreate(d.ctx, config, nil, nil, nil, "")
	if err != nil {
		return "", err
	}
	return containerResponse.ID, nil
}

func (d *DockerClient) StartContainer(containerID string) (string, error) {
	err := d.cli.ContainerStart(d.ctx, containerID, types.ContainerStartOptions{})
	if err != nil {
		return "", err
	}
	statusCh, errCh := d.cli.ContainerWait(d.ctx, containerID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			panic(err)
		}
	case <-statusCh:
	}
	return containerID, nil
}

func (d *DockerClient) StopContainer(containerID string) error {
	return d.cli.ContainerStop(d.ctx, containerID, nil)
}

func (d *DockerClient) RemoveContainer(containerID string) error {
	return d.cli.ContainerRemove(d.ctx, containerID, types.ContainerRemoveOptions{})
}

func (d *DockerClient) GetContainerLogs(containerID string) (string, error) {
	logs, err := d.cli.ContainerLogs(d.ctx, containerID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
	})
	if err != nil {
		return "", err
	}
	defer logs.Close()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(logs)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

func (d *DockerClient) Close() {
	d.cli.Close()
}

func GetContext(filePath string) io.Reader {
	filePath, _ = homedir.Expand(filePath)
	ctx, _ := archive.TarWithOptions(filePath, &archive.TarOptions{})
	return ctx
}

func BuildAndRun(imagename, dockerFilePath string) string {
	client, err := newDockerClient()
	check(err)
	defer client.Close()

	err, rd := client.BuildImage(dockerFilePath, imagename)
	check(err)
	err, _ = printReader(rd)

	check(err)

	id, err := client.CreateContainer(imagename)
	check(err)
	_, err = client.StartContainer(id)
	check(err)
	logs, err := client.GetContainerLogs(id)
	check(err)
	defer client.RemoveContainer(id)
	defer client.StopContainer(id)
	return logs
}

func check(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
