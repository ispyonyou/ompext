Dev installation:

1. Install dependencies.
```
> npm install
```

2. Rebuild oracledb against the current installed Electron version. Correct electron version is version from VSCode.
```
> npm install -g nan
> npm root -g
C:\Users\AvsOmega\AppData\Roaming\npm\node_modules
> set NOTE_PATH=C:\Users\AvsOmega\AppData\Roaming\npm\node_modules

> .\node_modules\.bin\electron-rebuild.cmd --version=2.0.12 --arch=x64
√ Rebuild Complete
```

If we get some msbuild errors, first of all ensure that  msbuild does not exist in PATH folders. You can check it with command:

```
> where msbuild
INFO: Could not find files for the given pattern(s).
```
 