import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

export function showBanner() {
    const text = figlet.textSync('CSCC\nAUTO-DEPLOY', {
        font: 'Big',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });

    const gradientText = gradient.pastel.multiline(text);
    
    const box = boxen(gradientText, {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
        title: 'v1.0.0',
        titleAlignment: 'center'
    });

    console.log(box);
    
    // Main info box
    console.log(gradient.pastel.multiline(
        boxen(
            ' Welcome to CSCC Auto-Deploy CLI\n' +
            '📦 Fast and Secure Deployment Tool\n' +
            '🔧 FTP & SSH Support',
            {
                padding: 1,
                margin: { top: 0, bottom: 1 },
                borderStyle: 'round',
                borderColor: 'cyan',
                dimBorder: true
            }
        )
    ));

    // Developer credits
    console.log(gradient.pastel.multiline(
        boxen(
            '��‍💻 Developed by MEHDI HARZALLAH\n' +
            '🔗 GitHub: https://github.com/opestro',
            {
                padding: 1,
                margin: { top: 0, bottom: 1 },
                borderStyle: 'round',
                borderColor: 'magenta',
                title: 'Developer',
                titleAlignment: 'center'
            }
        )
    ));

    // Commands and info
    console.log(gradient.pastel.multiline(
        boxen(
            'Available Commands:\n\n' +
            '🚀 deploy     - Deploy your web project\n' +
            '⚙️  config     - Manage saved configurations\n' +
            '🎯 init       - Initialize project configuration\n' +
            '📊 status     - Show tracking information\n' +
            '🔍 check-ignore - Check ignore patterns\n' +
            '✏️  edit       - Edit specific configuration\n' +
            '📌 version    - Show version information\n\n' +
            'Features:\n' +
            '• FTP & SSH/SFTP Support\n' +
            '• File tracking and caching\n' +
            '• Ignore patterns (.cscc-ignore)\n' +
            '• Configuration management\n' +
            '• Secure credential handling\n' +
            '• Progress tracking and logging',
            {
                padding: 1,
                margin: { top: 0, bottom: 1 },
                borderStyle: 'round',
                borderColor: 'green',
                title: 'Quick Reference',
                titleAlignment: 'center'
            }
        )
    ));

    // Usage example
    console.log(gradient.pastel.multiline(
        boxen(
            'Quick Start:\n\n' +
            '1. Initialize project:\n' +
            '   $ csdeploy init\n\n' +
            '2. Configure deployment:\n' +
            '   $ csdeploy config\n\n' +
            '3. Deploy your project:\n' +
            '   $ csdeploy deploy',
            {
                padding: 1,
                margin: { top: 0, bottom: 1 },
                borderStyle: 'round',
                borderColor: 'yellow',
                title: 'Getting Started',
                titleAlignment: 'center'
            }
        )
    ));
} 