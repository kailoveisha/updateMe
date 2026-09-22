/**
 * The emoji picker's contents. Kept to emoji that render on every mainstream device
 * (Unicode 13 and older), so nobody sees empty boxes.
 */
export interface EmojiCategory {
  id: string;
  label: string;
  emojis: string[];
}

const EMOJI = /\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;

/** Splits a run of emoji into single emoji (keeps variation selectors and ZWJ sequences together). */
const split = (s: string): string[] => s.match(EMOJI) ?? [];

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'faces',
    label: 'Faces',
    emojis: split(`
      😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳
      😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥
      😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕😈👻💀☠️👽🤖💩🙈🙉🙊
    `),
  },
  {
    id: 'people',
    label: 'Hands & people',
    emojis: split(`
      👍👎👌🤌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️👋🤚🖐️✋🖖👏🙌👐🤲🤝🙏✍️💅🤳💪🦾
      👀👁️🧠🦷👅👄💋👶🧒👦👧🧑👨👩🧓👴👵🙋🙆🙅🤷🤦💁🙇🚶🏃💃🕺👯🧘🛌
    `),
  },
  {
    id: 'hearts',
    label: 'Hearts & sparks',
    emojis: split(`
      ❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✨⭐🌟💫🔥💥💢💯✅❌❓❗
      ‼️⚠️💤💬💭🗯️🎵🎶➕➖➡️⬅️⬆️⬇️🔁🔔🔕♾️🆗🆒🆕🆓
    `),
  },
  {
    id: 'nature',
    label: 'Animals & nature',
    emojis: split(`
      🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐢🐍🦎
      🐙🦑🦀🐠🐟🐬🐳🦈🐘🦒🦓🐪🐑🐐🐕🐈🐇🐿️🌵🌲🌳🌴🌱🌿☘️🍀🍁🍂🍃
      🌺🌻🌹🌷🌼🌸💐🌙🌞🌈☁️⛅🌧️⛈️⚡❄️☃️🌊🔥🌍🌋
    `),
  },
  {
    id: 'food',
    label: 'Food & drink',
    emojis: split(`
      🍎🍐🍊🍋🍌🍉🍇🍓🍈🍒🍑🥭🍍🥥🥝🍅🥑🍆🥔🥕🌽🌶️🥒🥬🥦🧄🧅🍄🥜
      🍞🥐🥖🧀🥚🍳🥞🧇🥓🍔🍟🍕🌭🥪🌮🌯🍜🍝🍣🍱🍙🍚🍛🍦🍧🍨🍩🍪🎂🍰🧁🍫🍬🍭🍮
      ☕🍵🧃🥤🍺🍻🍷🥂🍸🍹🍾🧋
    `),
  },
  {
    id: 'play',
    label: 'Play & things',
    emojis: split(`
      ⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥊🎯🎮🕹️🎲🧩🎨🎬🎤🎧🎸🎹🥁🎻📚✏️🖊️📷📸🎁🎉🎊🎈🏆🥇
      📱💻🖥️⌚🔋💡🔦🕯️📌📎✂️🔑🔒🎒👜👓🕶️👑💍💎☂️🧸🛒💸
    `),
  },
  {
    id: 'places',
    label: 'Travel',
    emojis: split(`
      🚗🚕🚌🚲🛵🚂✈️🚀🚢⛵🏠🏡🏢🏖️🏝️⛰️🗻🏕️🌆🌇🌃🌉🗺️🧭⛺🎡🎢
      🌅🌄🌠🎑🏙️🛣️⛽🚦
    `),
  },
];
