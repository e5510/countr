const { getPermissionLevel } = require("../constants/index.js"), { deleteMessages } = require("./counting.js"), fs = require("fs"), config = require("../../config.json");

// loading commands
const commands = new Map(), aliases = new Map(), statics = require("../commands/_static.json");
fs.readdir("./src/commands/", (err, files) => {
  if (err) return console.log(err);
  for (const file of files) if (file.endsWith(".js")) {
    const commandFile = require(`../commands/${file}`), fileName = file.replace(".js", "");
    if (config.isPremium || !commandFile.premiumOnly) {
      commands.set(fileName, commandFile);
      if (commandFile.aliases) for (const alias of commandFile.aliases) aliases.set(alias, fileName);
    }
  }
});

module.exports = async (message, gdb, db, countingChannel, prefix) => {
  let content;
  if (message.content.match(`^<@!?${message.client.user.id}> `)) content = message.content.split(" ").slice(1);
  else content = message.content.slice(prefix.length).split(" ");
  const commandOrAlias = content.shift().toLowerCase(), commandName = aliases.get(commandOrAlias) || commandOrAlias;
  content = content.join(" ");

  const static = statics.find(s => s.triggers.includes(commandName));
  if (!static && !commands.has(commandName)) { // this is not a command
    if (message.channel.id == countingChannel) return deleteMessages([ message ]);
    else return;
  }

  function processCommand() {
    if (static) return message.channel.send(static.message.replace(/{{BOT_ID}}/g, message.client.user.id));

    const commandFile = commands.get(commandName);

    if (message.channel.id == countingChannel && !commandFile.allowInCountingChannel) return message.channel.send("❌ This command is disabled inside the counting channel.");
    
    const permissionLevel = getPermissionLevel(message.member);
    if (permissionLevel < commandFile.permissionRequired) return message.channel.send("❌ You don't have permission to do this.");

    const args = (content.match(/"[^"]+"|[^ ]+/g) || []).map(arg => arg.startsWith("\"") && arg.endsWith("\"") ? arg.slice(1).slice(0, -1) : arg);
    if (!commandFile.checkArgs(args, permissionLevel)) return message.channel.send(`❌ Invalid arguments. For help, type \`${prefix}help ${commandName}\`.`);

    return commandFile.run(message, args, gdb, { prefix, permissionLevel, db, content });
  }

  const response = await processCommand();
  if (message.channel.id == countingChannel) setTimeout(() => message.channel.id == gdb.get().channel ? deleteMessages([ message, response ]) : null, 5000);
};