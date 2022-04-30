GOOS=js GOARCH=wasm go build -o main.wasm
cp "${GOROOT}/misc/wasm/wasm_exec.js" .