# peercode notes

## API Description

1. Share session:
2. Join Other's session:
3. stop Session as Room owner
4. leave session
5. show participants
6. paint
7. run file
8. show output
9. share port

### Start Session / Create new room

command:
> `peercode: Start Session`

Inputs:

1. room name
2. username
3. signaling server address (optional)

To share session user must have opened Folder which will be shared to other peers

### Join Session / Join room

command:
> `peercode: Join Session`

Inputs:

1. room name
2. username
3. signaling server address (optional)

In Explorer, tree view will be opened for Shared Folder from Session/Room owner

## Recourses

[vscode guide](https://code.visualstudio.com/api/extension-guides/overview)
[samples](https://github.com/microsoft/vscode-extension-samples)

## code snippets

```JSON
    "viewsContainers": {
      "activitybar": [
        {
          "id": "peercode-sidebar-view",
          "title": "PeerCode",
          "icon": "media/peercode.svg"
        }
      ]
    },
    "views": {
      "vstodo-sidebar-view": [
        {
          "type": "webview",
          "id": "peercode-sidebar",
          "name": "PeerCode",
          "icon": "media/peercode.svg",
          "contextualTitle": "PeerCode"
        }
      ]
    },
