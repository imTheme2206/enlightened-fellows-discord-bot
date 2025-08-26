// import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
// import { generateEventCards } from 'mh-wilds-event-card-generator';
// import {
//   MHWIldsEventResponse,
//   parseMHWildsEvents,
// } from 'mh-wilds-event-scraper';

// export const data = new SlashCommandBuilder()
//   .setName('cards')
//   .setDescription('Return a list of event scheduled as an image');

// export async function execute(interaction: CommandInteraction) {
//   await interaction.deferReply();

//   try {
//     const MHWildsEvents: MHWIldsEventResponse = await parseMHWildsEvents(
//       'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
//     );

//     if (
//       MHWildsEvents.limitedEventQuests.length === 0 &&
//       MHWildsEvents.permanentQuests.length === 0
//     ) {
//       return interaction.editReply('No events found.');
//     }

//     const { eventBoardBuffer, freeChallengeBoardBuffer } =
//       await generateEventCards(MHWildsEvents.limitedEventQuests[0]);

//     if (!eventBoardBuffer || !freeChallengeBoardBuffer) {
//       return interaction.editReply('Failed to generate event cards.');
//     }

//     return interaction.editReply({
//       content: 'Here are the event cards:',
//       files: [
//         {
//           name: 'event-board.png',
//           attachment: eventBoardBuffer,
//           contentType: 'image/png',
//         },
//         {
//           name: 'free-challenge-board.png',
//           attachment: freeChallengeBoardBuffer,
//           contentType: 'image/png',
//         },
//       ],
//     });
//   } catch (error) {
//     console.error(error);
//     return interaction.editReply('Failed to generate event cards.');
//   }
// }
