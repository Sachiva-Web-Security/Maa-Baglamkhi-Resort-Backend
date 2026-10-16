module.exports = {
  apps: [
    {
      name: "resort-frontend",
      cwd: "C:/Users/maaba/resort/Maa-Baglamkhi-Resort-frontend",

      script: "C:/Program Files/nodejs/node.exe",
      args: [
        "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js",
        "run",
        "preview",
        "--",
        "--host",
        "0.0.0.0",
        "--port",
        "5173"
      ],

      interpreter: "none",
      exec_mode: "fork",
      windowsHide: true
    }
  ]
};