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
} 