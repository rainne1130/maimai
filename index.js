require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, REST, Routes,
  SlashCommandBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder,EmbedBuilder
} = require('discord.js');

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, runTransaction } = require('firebase/database');
const TICKET_CATEGORY_ID = "1500721404201664562";
const VOICE_CATEGORY_ID = "1495429606701007001";

// ===== Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyDlY7yyjaf696mfz3T6IaDNQsCWLrC_G9I",
  authDomain: "maimai-eec26.firebaseapp.com",
  databaseURL: "https://maimai-eec26-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "maimai-eec26",
  storageBucket: "maimai-eec26.appspot.com",
  messagingSenderId: "127362679664",
  appId: "1:127362679664:web:15a057e23cb8df67e085b5"
};
const giftImages = {
	"50": "https://cdn.discordapp.com/attachments/1495436285815427082/1500923539409080380/-1_0.png?ex=69fa3379&is=69f8e1f9&hm=2fa9425eb8d888af4c6788b8f257e02d572bfaad5ccd8ea17326225643d0421e&",
	"500": "https://cdn.discordapp.com/attachments/1495436285815427082/1500923539409080380/-1_0.png?ex=69fa3379&is=69f8e1f9&hm=2fa9425eb8d888af4c6788b8f257e02d572bfaad5ccd8ea17326225643d0421e&",
	"888": "https://cdn.discordapp.com/attachments/1495436285815427082/1500923539409080380/-1_0.png?ex=69fa3379&is=69f8e1f9&hm=2fa9425eb8d888af4c6788b8f257e02d572bfaad5ccd8ea17326225643d0421e&",
	"1314": "https://cdn.discordapp.com/attachments/1495436285815427082/1500923539409080380/-1_0.png?ex=69fa3379&is=69f8e1f9&hm=2fa9425eb8d888af4c6788b8f257e02d572bfaad5ccd8ea17326225643d0421e&",
	"9999": "https://cdn.discordapp.com/attachments/1495436285815427082/1500923539409080380/-1_0.png?ex=69fa3379&is=69f8e1f9&hm=2fa9425eb8d888af4c6788b8f257e02d572bfaad5ccd8ea17326225643d0421e&"
	
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== 設定 =====
const GUILD_ID = "1495429605866213386";
const SERVICE_ROLE_ID = "1495433255946817557";//老闆身分組
const RATING_CHANNEL_ID = "1500653398473576628";//初始工單頻道

const client = new Client({ intents: [GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers] });

// ===== 指令 =====
const commands = [
  new SlashCommandBuilder()
  .setName('panel')
  .setNameLocalizations({ 'zh-TW': '菜單目錄' })
  .setDescription('發送工單面板'),
  new SlashCommandBuilder()
  .setName('balance')
  .setNameLocalizations({ 'zh-TW': '目前Q幣' })
  .setDescription('查詢餘額')
  .addUserOption(o =>
    o.setName('user')
     .setDescription('查詢玩家餘額Q幣（管理員功能）')
     .setRequired(false)
  ),
  new SlashCommandBuilder()
    .setName('total')
	.setNameLocalizations({ 'zh-TW': '累積Q幣' })
    .setDescription('查詢累積儲值')
    .addUserOption(o =>
      o.setName('user')
       .setDescription('查詢玩家累積Q幣（管理員功能）')
       .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('add')
	.setNameLocalizations({ 'zh-TW': '儲值Q幣' })
    .setDescription('儲值')
    .addUserOption(o => o.setName('user').setDescription('老闆名稱').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Q幣金額').setRequired(true)),

  new SlashCommandBuilder()
    .setName('charge')
	.setNameLocalizations({ 'zh-TW': '扣款Q幣' })
    .setDescription('扣款')
    .addUserOption(o => o.setName('user').setDescription('老闆名稱').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Q幣金額').setRequired(true)),
	
	new SlashCommandBuilder()
	  .setName('gift')
	  .setNameLocalizations({ 'zh-TW': '送禮物' })
	  .setDescription('送禮給陪陪')
	  .addUserOption(o =>
		o.setName('user')
		 .setDescription('選擇陪陪')
		 .setRequired(true)
	  )
	  .addStringOption(o =>
		o.setName('gift')
		 .setDescription('禮物名稱')
		 .setRequired(true)
	  )
];

// ===== 註冊 =====
client.once(Events.ClientReady, async () => {
  console.log(`已上線：${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );
});

// ===== 工具 =====
async function updateBalance(userId, delta) {
  const result = await runTransaction(ref(db, `balances/${userId}`), v => {
    const newVal = (v || 0) + delta;
    if (newVal < 0) return v;
    return newVal;
  });

  return result.snapshot.val();
}

async function getBalance(userId) {
  const snap = await get(ref(db, `balances/${userId}`));
  return snap.exists() ? snap.val() : 0;
}
async function addRechargeTotal(userId, amount) {
  await runTransaction(ref(db, `totalRecharge/${userId}`), v => {
    return (v || 0) + amount;
  });
}

async function getRechargeTotal(userId) {
  const snap = await get(ref(db, `totalRecharge/${userId}`));
  return snap.exists() ? snap.val() : 0;
}

async function getNextTicketId() {
  const counterRef = ref(db, "ticketCounter");

  const result = await runTransaction(counterRef, (current) => {
    return (current || 0) + 1;
  });

  return String(result.snapshot.val()).padStart(4, '0');
}
async function handleGift(i, sender, targetId, giftName) {

  const targetMember = await i.guild.members.fetch(targetId).catch(() => null);

  if (!targetMember || !targetMember.roles.cache.has(SERVICE_ROLE_ID)) {
    return {
      error: "❌ 只能送禮給陪陪"
    };
  }

  await i.channel.send({
    content: `🎁 感謝玩家 ${sender} 送給了 <@${targetId}> 【${giftName}】！`
  });

  return {
    success: true,
    target: `<@${targetId}>`,
    giftName
  };
}

// ===== 主事件 =====
client.on(Events.InteractionCreate, async (i) => {
  try {

    // ===== Slash 指令 =====
    if (i.isChatInputCommand()) {

      if (i.commandName === "panel") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('game').setLabel('🎮 遊戲訂單').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('voice').setLabel('🎤 語音訂單').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('boost').setLabel('💻 代打訂單').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('gift').setLabel('🎁 送禮物').setStyle(ButtonStyle.Danger)
        );
        return i.reply({ content: "💖 奈奈客服中心\n請選擇服務類型", components: [row] });
      }

      if (i.commandName === "balance") {
        const target = i.options.getUser("user");

        if (target) {
          if (!i.member.roles.cache.has(SERVICE_ROLE_ID)) {
            return i.reply({ content: "❌ 你沒有權限查詢他人餘額", ephemeral: true });
          }
          const balance = await getBalance(target.id);
          return i.reply({ content: `💰 ${target} 的餘額為：${balance} 元`, ephemeral: true });
        }

        const balance = await getBalance(i.user.id);
        return i.reply({ content: `💰 你的餘額為：${balance} 元`, ephemeral: true });
      }

      if (i.commandName === "total") {
        const target = i.options.getUser("user");

        if (target) {
          if (!i.member.roles.cache.has(SERVICE_ROLE_ID)) {
            return i.reply({ content: "❌ 您沒有權限查詢他人累積", ephemeral: true });
          }
          const total = await getRechargeTotal(target.id);
          return i.reply({ content: `💎 ${target} 的累積儲值為： ${total} 元`, ephemeral: true });
        }

        const total = await getRechargeTotal(i.user.id);
        return i.reply({ content: `💎 您的累積儲值為： ${total} 元`, ephemeral: true });
      }

      if (i.commandName === "add") {

		  const user = i.options.getUser("user");
		  const amount = i.options.getInteger("amount");

		  if (!user)
			return i.reply({ content: "❌ 玩家不存在", ephemeral: true });

		  if (amount == null || amount <= 0)
			return i.reply({ content: "❌ 金額必須大於 0", ephemeral: true });

		  if (!i.member.roles.cache.has(SERVICE_ROLE_ID))
			return i.reply({ content: "❌ 您沒有權限", ephemeral: true });

		  const newBalance = await updateBalance(user.id, amount);

		  await addRechargeTotal(user.id, amount);
		  const total = await getRechargeTotal(user.id);

		  const embed = new EmbedBuilder()
  .setTitle("💰 恭喜您加值成功！")
  .setDescription(
`👤 玩家名稱：${user.username}
💰 本次加值金額：${amount} 元
💵 總計剩餘金額：${newBalance} 元
💎 累積儲值金額：${total} 元`
  )
  .setColor(0xFF69B4);

return i.reply({ embeds: [embed] });
		}

      if (i.commandName === "charge") {

		  const user = i.options.getUser("user");
		  const amount = i.options.getInteger("amount");

		  if (!user)
			return i.reply({ content: "❌ 玩家不存在", ephemeral: true });

		  if (amount == null || amount <= 0)
			return i.reply({ content: "❌ 金額必須大於 0", ephemeral: true });

		  if (!i.member.roles.cache.has(SERVICE_ROLE_ID))
			return i.reply({ content: "❌ 您目前沒有權限", ephemeral: true });

		  const balance = await getBalance(user.id);

		  if (balance < amount)
			return i.reply({ content: "❌ 您目前餘額不足", ephemeral: true });

		  const newBalance = await updateBalance(user.id, -amount);

		  const total = await getRechargeTotal(user.id);

		  const embed = new EmbedBuilder()
  .setTitle("💸 扣款成功！")
  .setDescription(
`👤 玩家名稱：${user.username}
💰 本次扣款金額：${amount} 元
💵 總計剩餘金額：${newBalance} 元
💎 累積儲值金額：${total} 元`
  )
  .setColor(0xFF69B4);

return i.reply({ embeds: [embed] });
		}
		if (i.commandName === "gift") {

		  const target = i.options.getUser("user");
		  const giftName = i.options.getString("gift");

		  if (!target)
			return i.reply({ content: "❌ 玩家不存在", ephemeral: true });

		  const result = await handleGift(i, i.user, target.id, giftName);

		  if (result.error) {
			return i.reply({ content: result.error, ephemeral: true });
		  }

		  const embed = new EmbedBuilder()
  .setTitle("🎁 送禮成功！")
  .setDescription(
`👤 接收禮物的對象：${result.target}
🎁 禮物名稱：${result.giftName}`
  )
  .setColor(0xFF69B4);

return i.reply({ embeds: [embed], ephemeral: true });
		}
    }

    // ===== Button =====
    if (i.isButton()) {

      if (i.customId === "create_voice") {

        if (!i.member.roles.cache.has(SERVICE_ROLE_ID)) {
          return i.reply({ content: "❌ 只有客服可以建立語音頻道", ephemeral: true });
        }

        const customerId = i.channel.permissionOverwrites.cache.find(p =>
		  p.allow.has(PermissionFlagsBits.ViewChannel) &&
		  p.id !== SERVICE_ROLE_ID &&
		  p.id !== client.user.id
		)?.id;

		if (!customerId) {
		  return i.reply({ content: "❌ 無法識別玩家", ephemeral: true });
		}

        const existing = i.guild.channels.cache.find(
          c =>
            c.type === ChannelType.GuildVoice &&
            c.name === `語音-${i.channel.name}` &&
            c.parentId === VOICE_CATEGORY_ID
        );

        if (existing) {
          return i.reply({ content: "❌ 已經建立過語音頻道", ephemeral: true });
        }

        const voiceChannel = await i.guild.channels.create({
          name: `語音-${i.channel.name}`,
          type: ChannelType.GuildVoice,
          parent: VOICE_CATEGORY_ID,
          permissionOverwrites: [
            { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
            { id: customerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
            { id: SERVICE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }
          ]
        });

        return i.reply({ content: `🔊 語音頻道已建立：${voiceChannel}`, ephemeral: true });
      }

      if (i.customId.startsWith("rate_")) {
        const ratedRef = ref(db, `rated/${i.channel.id}/${i.user.id}`);

        const result = await runTransaction(ratedRef, (current) => {
          if (current) return;
          return true;
        });

        if (!result.committed) {
          return i.reply({ content: "❌ 你已經評價過了", ephemeral: true });
        }

        const score = i.customId.split("_")[1];

        const modal = new ModalBuilder()
          .setCustomId(`rate_modal_${score}`)
          .setTitle("填寫評價");

        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("target").setLabel("給予評價對象").setRequired(true).setStyle(TextInputStyle.Short)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("content").setLabel("評價內容").setRequired(true).setStyle(TextInputStyle.Paragraph)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("anonymous").setLabel("請問是否匿名？(是/否)").setRequired(true).setStyle(TextInputStyle.Short))
        );

        return i.showModal(modal);
      }
      if (i.customId === "close") {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rate_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success)
        );

        await i.reply({ content: "請為本次服務評價⭐", components: [row], ephemeral: true });

        setTimeout(async () => {
          try {
            const ticketName = i.channel.name;

            const voice = i.guild.channels.cache.find(
              c =>
                c.type === ChannelType.GuildVoice &&
                c.name === `語音-${ticketName}`
            );

            if (voice) {
              await voice.delete().catch(() => {});
            }
          } catch (err) {
            console.error("刪除語音失敗:", err);
          }
        }, 5000);
      }

      // === 開單按鈕 ===
      const makeInput = (id, label, style) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId(id).setLabel(label).setRequired(true).setStyle(style)
        );

      if (i.customId === "game") {
        const modal = new ModalBuilder().setCustomId("game_modal").setTitle("遊戲需求");
        modal.addComponents(
          makeInput("companion", "選擇陪陪", TextInputStyle.Short),
          makeInput("game", "遊戲名稱", TextInputStyle.Short),
          makeInput("type", "遊戲類型", TextInputStyle.Short),
          makeInput("time", "遊玩時間", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }

      if (i.customId === "voice") {
        const modal = new ModalBuilder().setCustomId("voice_modal").setTitle("語音需求");
        modal.addComponents(
          makeInput("companion", "選擇陪陪", TextInputStyle.Short),
          makeInput("type", "語音類型", TextInputStyle.Short),
          makeInput("time", "遊玩時間", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }

      if (i.customId === "boost") {
        const modal = new ModalBuilder().setCustomId("boost_modal").setTitle("代打需求");
        modal.addComponents(
          makeInput("rank", "段位需求", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }
	  
	  if (i.customId === "gift") {

		  const ticketId = await getNextTicketId();

		  const channel = await i.guild.channels.create({
			name: `禮物_${ticketId}`,
			type: ChannelType.GuildText,
			parent: TICKET_CATEGORY_ID,
			permissionOverwrites: [
			  { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
			  { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] },
			  { id: SERVICE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
			  { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
			]
		  });
		  
		  const giftMenu = new ActionRowBuilder().addComponents(
			  new StringSelectMenuBuilder()
				.setCustomId("gift_select_item")
				.setPlaceholder("🎁 選擇想要送的禮物")
				.addOptions([
				  { label: "小的大便", value: "50" },
				  { label: "大的大便", value: "500" },
				  { label: "超級大便", value: "888" },
				  { label: "終極大便", value: "1314" },
				  { label: "究極大便", value: "9999" }
				])
			);
			await i.guild.members.fetch();
			const bossMembers = i.guild.members.cache.filter(m =>
			  m.roles.cache.has(SERVICE_ROLE_ID)
			);

			const bossMenu = new ActionRowBuilder().addComponents(
			  new StringSelectMenuBuilder()
				.setCustomId("gift_select_boss")
				.setPlaceholder("👤 選擇要送的陪陪")
				.addOptions(
				  bossMembers.map(m => ({
					label: m.displayName,
					value: m.id
				  }))
				)
			);
			const confirmBtn = new ActionRowBuilder().addComponents(
			  new ButtonBuilder()
				.setCustomId("gift_confirm")
				.setLabel("🎁 確認送出")
				.setStyle(ButtonStyle.Success)
			);

			await channel.send({
content: `🎁 禮物工單
👤 玩家：${i.user}
📌 請選擇禮物與陪陪`,
			  components: [giftMenu, bossMenu, confirmBtn]
			});
		  return i.reply({
			content: `✅ 已建立禮物工單：${channel}`,
			ephemeral: true
		  });
		}
		if (i.customId === "gift_confirm") {

		  const snap = await get(ref(db, `giftTemp/${i.channel.id}`));

		  if (!snap.exists()) {
			return i.reply({ content: "❌ 尚未選擇禮物或陪陪", ephemeral: true });
		  }

		  const { price, boss } = snap.val();

		  if (!price || !boss) {
			return i.reply({ content: "❌ 請先選擇完整", ephemeral: true });
		  }

		  const customerId = i.channel.permissionOverwrites.cache.find(p =>
			p.allow.has(PermissionFlagsBits.ViewChannel) &&
			p.id !== SERVICE_ROLE_ID &&
			p.id !== client.user.id
		  )?.id;

		  if (!customerId) {
			return i.reply({ content: "❌ 無法識別玩家", ephemeral: true });
		  }
		  if (i.user.id !== customerId) {
		  return i.reply({ content: "❌ 只有玩家本人可以送禮", ephemeral: true });
		}

		  const priceNum = parseInt(price);

		  const balance = await getBalance(customerId);

		  if (balance < priceNum) {
			return i.reply({ content: "❌ 餘額不足", ephemeral: true });
		  }


		  const newUserBalance = await updateBalance(customerId, -priceNum);

		  const bossIncome = Math.floor(priceNum * 0.9);
		  await updateBalance(boss, bossIncome);

		  const embed = new EmbedBuilder()
		  .setTitle("🎁 送禮成功！")
		  .setDescription(
`👤 玩家名稱：<@${customerId}>

👤 陪陪名稱：<@${boss}>

💰 禮物金額：${priceNum} 元
💵 玩家剩餘：${newUserBalance} 元`
		  )
		  .setImage(giftImages[price])
		  .setColor(0xFF69B4);

		await i.channel.send({
		  embeds: [embed]
		});

		  await set(ref(db, `giftTemp/${i.channel.id}`), null);

		  return i.reply({ content: "✅ 已完成送禮", ephemeral: true });
		}
    }
	if (i.isStringSelectMenu()) {

	  if (i.customId === "gift_select_item") {
		await set(ref(db, `giftTemp/${i.channel.id}/price`), i.values[0]);
		return i.reply({
		  content: `✅ 已選擇禮物（${i.values[0]} 元）`,
		  ephemeral: true
		});
	  }

	  if (i.customId === "gift_select_boss") {
		await set(ref(db, `giftTemp/${i.channel.id}/boss`), i.values[0]);
		return i.reply({
		  content: `✅ 已選擇陪陪`,
		  ephemeral: true
		});
	  }
	}
    // ===== Modal =====
    if (i.isModalSubmit()) {

      if (i.customId.startsWith("rate_modal_")) {
        await i.deferReply({ ephemeral: true });

        const score = i.customId.split("_")[2];
        const target = i.fields.getTextInputValue("target");
        const content = i.fields.getTextInputValue("content");
        const anonymous = i.fields.getTextInputValue("anonymous");

        const isAnon = ["是", "yes", "y", "true"].includes(anonymous.toLowerCase());
        const name = isAnon ? "匿名闆闆" : `${i.user}`;

        const channel = await client.channels.fetch(RATING_CHANNEL_ID);

        const embed = new EmbedBuilder()
  .setTitle("💎 客戶滿意好評")
  .setDescription(
`👤 客戶：${name}
🎯 對象：${target}
⭐ 評分：${"⭐".repeat(score)}

📝 評價：
${content}

📌 來自工單：${i.channel?.name || "未知"}`
  )
  .setColor(0xFFD700)
  .setTimestamp();

await channel.send({
  embeds: [embed]
});

        return i.editReply({ content: "✅ 評價完成" });
      }

      const ticketId = await getNextTicketId();

      const channel = await i.guild.channels.create({
        name: `奈奈電競-${ticketId}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SERVICE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_voice').setLabel('🔊 建立語音頻道').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('gift').setLabel('🎁 我要送禮').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('close').setLabel('🔒 我要結單').setStyle(ButtonStyle.Danger)
      );

      let content = "";

      if (i.customId === "game_modal") {
        content = `🎮 遊戲單
陪陪：${i.fields.getTextInputValue("companion")}
遊戲：${i.fields.getTextInputValue("game")}
類型：${i.fields.getTextInputValue("type")}
時間：${i.fields.getTextInputValue("time")}`;
      }

      if (i.customId === "voice_modal") {
        content = `🎤 語音單
陪陪：${i.fields.getTextInputValue("companion")}
類型：${i.fields.getTextInputValue("type")}
時間：${i.fields.getTextInputValue("time")}`;
      }

      if (i.customId === "boost_modal") {
        content = `💻 代打單
段位：${i.fields.getTextInputValue("rank")}`;
      }
	  
      await channel.send({
        content: `<@&${SERVICE_ROLE_ID}>

📌 工單 #${ticketId}
👤 玩家名稱：${i.user}

${content}`,
        components: [row]
      });

      return i.reply({ content: `✅ 已建立工單：${channel}`, ephemeral: true });
    }

  } catch (e) {
    console.error(e);
    if (i.replied || i.deferred) {
      i.followUp({ content: "❌ 系統錯誤", ephemeral: true });
    } else {
      i.reply({ content: "❌ 系統錯誤", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
