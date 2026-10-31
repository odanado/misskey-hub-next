import { getIOEmoji } from './io-meta';
import * as Misskey from 'misskey-js';
export const customEmojisMap = new Map<string, Misskey.entities.EmojiSimple>();

async function init() {
    const emojis = await getIOEmoji();

    for (const emoji of emojis.emojis) {
        customEmojisMap.set(emoji.name, emoji);
    }
}

void init().catch(error => console.warn('Emoji provider unavailable:', error));