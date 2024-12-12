import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import chalk from 'chalk';

export function showBanner() {
    // Compact, modern title with gradient
    const text = figlet.textSync('csdeploy', {
        font: 'Small',
        horizontalLayout: 'fitted',
        verticalLayout: 'fitted'
    });

    const gradientText = gradient(['#2997FF', '#A855F7']).multiline(text);
    
    // Minimal title box with version
    const box = boxen(
        gradientText + '\n' +
        gradient(['#2997FF', '#A855F7'])('Modern Deployment CLI'),
        {
            padding: { top: 0, bottom: 0, left: 2, right: 2 },
            margin: { top: 1, bottom: 0 },
            borderStyle: 'round',
            borderColor: '#2997FF',
            float: 'center',
            title: '✨ 1.3.2',
            titleAlignment: 'center'
        }
    );

    console.log(box);
    
    // Modern quick command reference
    console.log(
        boxen(
            `${chalk.gray('$')} ${chalk.white('csdeploy')} ${chalk.cyan('<')}${chalk.yellow('init')}${chalk.cyan('>')}   ${chalk.gray('•')}   ` +
            `${chalk.gray('$')} ${chalk.white('csdeploy')} ${chalk.cyan('<')}${chalk.yellow('deploy')}${chalk.cyan('>')}   ${chalk.gray('•')}   ` +
            `${chalk.gray('$')} ${chalk.white('csdeploy')} ${chalk.cyan('<')}${chalk.yellow('browse')}${chalk.cyan('>')} ${chalk.gray('•')}   ` +
            `${chalk.gray('$')} ${chalk.white('csdeploy')} ${chalk.cyan('<')}${chalk.yellow('config')}${chalk.cyan('>')}`,
            {
                padding: { top: 0, bottom: 0, left: 2, right: 2 },
                margin: { top: 0, bottom: 0 },
                borderStyle: 'round',
                borderColor: '#A855F7',
                dimBorder: true,
                float: 'center'
            }
        )
    );

    // Minimal footer with GitHub link
    console.log(
        boxen(
            gradient(['#2997FF', '#A855F7'])('Crafted by Mehdi') + 
            chalk.gray(' • ') + 
            chalk.cyan('github.com/opestro'),
            {
                padding: { top: 0, bottom: 0, left: 2, right: 2 },
                margin: { top: 1, bottom: 1 },
                borderStyle: 'round',
                borderColor: '#2997FF',
                dimBorder: true,
                float: 'center'
            }
        )
    );
} 