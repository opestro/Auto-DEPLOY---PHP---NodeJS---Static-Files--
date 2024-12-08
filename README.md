<div align="center">
  
# 🚀 CSCC AUTO-DEPLOY

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-brightgreen.svg)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> Fast, Secure, and Modern Web Deployment CLI Tool

## ✨ Features

- 🐳 **Docker-like Command Syntax**
  - Use familiar Docker-style commands (`RUN`, `COPY`, `MOVE`, `WORKDIR`)
  - Execute remote commands with ease
  - Manage file operations efficiently

- 🔄 **Flexible Deployment Options**
  - Deploy files only
  - Run commands only
  - Combined file and command deployment
  - Selective file deployment with ignore patterns

- 🔒 **Enhanced Security**
  - SSH key-based authentication
  - Secure SFTP/SSH connections
  - FTP with TLS support
  - Configurable key passphrases

- ⚡ **Project-Specific Configuration**
  - Local `.cscc-deploy/config.json` storage
  - `.cscc-ignore` for excluding files
  - `.deploycommands` for deployment scripts
  - Multiple environment support

## 📦 Installation

```bash
npm install -g csdeploy
```

## 🛠️ Configuration

Create a new configuration:

```bash
csdeploy init
```

This will create:
- `.cscc-deploy/config.json` - Connection settings
- `.cscc-ignore` - Files to exclude
- `.deploycommands` - Deployment script

Example `.deploycommands`:
```bash
# Change working directory
WORKDIR ./public_html

# Run commands
RUN git clone https://github.com/your/repo.git
RUN npm install

# Copy or move files
COPY ./dist/* ./public/
# or
MOVE ./build/* ./public/
```

## 🚀 Usage

### Basic Deployment

```bash
csdeploy deploy
```

Choose your deployment type:
- Files only
- Commands only
- Both files and commands

### Edit Configuration

```bash
csdeploy edit
```

### View Deployment Status

```bash
csdeploy status
```

## 🔧 Configuration Options

```json
{
  "host": "your-server.com",
  "username": "user",
  "privateKey": ".ssh/id_rsa",
  "remotePath": "public_html/",
  "localPath": "./Project",
  "passphrase": "optional",
  "type": "SFTP/SSH"
}
```

## 💻 Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- SSH access (for SFTP/SSH deployment)
- FTP access (for FTP deployment)

## 📝 License

MIT 

## 🤝 Contributing

1. Fork it
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -am 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Create a Pull Request

---

<div align="center">
Made with ❤️ by [Mehdi Harzallah](https://github.com/opestro)

</div>
