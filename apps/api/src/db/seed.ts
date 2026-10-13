import db from "@/db";
import { channels } from "@/db/schema";

async function main() {
  const existing = await db.query.channels.findMany();
  if (existing.length === 0) {
    await db.insert(channels).values([
      { name: "general", description: "Team-wide announcements and chat" },
    ]);
    console.log("seeded: general channel");
  }
  else {
    console.log(`seed skipped: ${existing.length} channel(s) already exist`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
