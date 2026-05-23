// import { backendToEngineClient } from "./lib/redis-client";

// for (;;) {
//   const streams: any = await brokerClient.xReadGroup(
//     GROUP_ENGINE,
//     "engine-1",
//     { key: STREAM, id: ">" },
//     { COUNT: 1, BLOCK: 0 },
//   );
//   if (!streams) continue;

//   for (const stream of streams) {
//     for (const { id, message } of stream.messages) {
//       let request: EngineRequest;

//       try {
//         request = JSON.parse(message["data"]) as EngineRequest;
//       } catch {
//         logger.error({ id }, "Skipping unparseable broker message");
//         await brokerClient.xAck(STREAM, GROUP_ENGINE, id);
//         continue;
//       }

//       try {
//         const data = handleEngineRequest(message);
//         await sendResponse({
//           correlationId: message.correlationId,
//           ok: true,
//           data,
//         });
//       } catch (error) {
//         await sendResponse({
//           correlationId: message.correlationId,
//           ok: false,
//           error: error instanceof Error ? error.message : "engine_error",
//         });
//       }

//       await brokerClient.xAck(STREAM, GROUP_ENGINE, id);
//     }
//   }
// }
