<img src="http://i.imgur.com/M5TvvSy.png" alt="clive-mascot" width=64px />

## ☝️ That's Clive
He's a very simple bot that monitors Twitch chat for clips and auto-posts them to Discord. He runs on a diet of [nodejs](https://nodejs.org/en/) and [tmi.js](https://docs.tmijs.org/v1.2.1/index.html). He needs to live on a server (like an [Amazon EC2 instance](https://aws.amazon.com/getting-started/tutorials/launch-a-virtual-machine/)).

**Some assembly required (it helps to know code!).**

## 🤖 Instructions (OSX/Linux)
Before starting, make sure [nodejs](https://nodejs.org/en/download/) is installed. You will also need a [webhook](https://support.discordapp.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for the Discord channel where these clips will be posted.

1. Open terminal.
2. Navigate to a directory (like `~/Developer`).
3. Run `git clone https://github.com/mangosango/Clive.git && cd Clive`.
4. Run `npm install`
5. Open `index.js` in a text editor (like [atom](https://atom.io/)).
6. Modify the line `channels: ["#mrchowderclam"]` to your Twitch channel. Keep the `#` in front of the channel. For example, if you wanted to watch for clips in `Monstercat`'s chat, you would use `channels: ["#monstercat"]`. If you wanted to monitor multiple channels, you would use `channels: ["#monstercat", "#mrchowderclam"]`.
7. Save `index.js`.
8. In terminal, run `npm start`.
9. ???
10. Profit.

## 📋 Todo
- Option to only post clips from a certain channel.
- Having a UI or hosting this somewhere would be nice.
