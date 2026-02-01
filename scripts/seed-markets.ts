import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "gramshis.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

interface MarketSeed {
  name: string;
  description: string;
  outcomes: string[];
}

// 2026 Grammy Awards (68th Annual) - February 1, 2026
// Final 15 Grammy categories we are using based on Kalshi availability
const markets: MarketSeed[] = [
  {
    name: "Song Of The Year",
    description: "Awarded to the songwriter(s) of the best song of the year",
    outcomes: [
      "Abracadabra - Lady Gaga",
      "Anxiety - Doechii",
      "APT. - ROSÉ & Bruno Mars",
      "DtMF - Bad Bunny",
      "Golden - HUNTR/X",
      "luther - Kendrick Lamar & SZA",
      "Manchild - Sabrina Carpenter",
      "WILDFLOWER - Billie Eilish",
    ],
  },
  {
    name: "Best New Artist",
    description: "Awarded to the best new artist who releases their first recording",
    outcomes: [
      "Olivia Dean",
      "KATSEYE",
      "The Marias",
      "Addison Rae",
      "sombr",
      "Leon Thomas",
      "Alex Warren",
      "Lola Young",
    ],
  },
  {
    name: "Album Of The Year",
    description: "Awarded for the overall production of an album",
    outcomes: [
      "DeBÍ TiRAR MáS FOToS - Bad Bunny",
      "SWAG - Justin Bieber",
      "Man's Best Friend - Sabrina Carpenter",
      "Let God Sort Em Out - Clipse",
      "MAYHEM - Lady Gaga",
      "GNX - Kendrick Lamar",
      "MUTT - Leon Thomas",
      "CHROMAKOPIA - Tyler, The Creator",
    ],
  },
  {
    name: "Record Of The Year",
    description: "Awarded for the overall production of a single song",
    outcomes: [
      "DtMF - Bad Bunny",
      "Manchild - Sabrina Carpenter",
      "Anxiety - Doechii",
      "WILDFLOWER - Billie Eilish",
      "Abracadabra - Lady Gaga",
      "luther - Kendrick Lamar & SZA",
      "The Subway - Chappell Roan",
      "APT. - ROSÉ & Bruno Mars",
    ],
  },
  {
    name: "Best Rap Album",
    description: "Awarded to the best rap album of the year",
    outcomes: [
      "Let God Sort Em Out - Clipse",
      "GLORIOUS - GloRilla",
      "God Does Like Ugly - JID",
      "GNX - Kendrick Lamar",
      "CHROMAKOPIA - Tyler, The Creator",
    ],
  },
  {
    name: "Best Pop Duo/Group Performance",
    description: "Awarded to the best pop collaboration",
    outcomes: [
      "Defying Gravity - Cynthia Erivo & Ariana Grande",
      "Golden - HUNTR/X",
      "Gabriela - KATSEYE",
      "APT. - ROSÉ & Bruno Mars",
      "30 For 30 - SZA feat. Kendrick Lamar",
    ],
  },
  {
    name: "Best Pop Vocal Album",
    description: "Awarded to the best pop vocal album",
    outcomes: [
      "SWAG - Justin Bieber",
      "Man's Best Friend - Sabrina Carpenter",
      "Something Beautiful - Miley Cyrus",
      "MAYHEM - Lady Gaga",
      "I've Tried Everything But Therapy Part 2 - Teddy Swims",
    ],
  },
  {
    name: "Best Pop Solo Performance",
    description: "Awarded to the best pop solo performance",
    outcomes: [
      "DAISIES - Justin Bieber",
      "Manchild - Sabrina Carpenter",
      "Disease - Lady Gaga",
      "The Subway - Chappell Roan",
      "Messy - Lola Young",
    ],
  },
  {
    name: "Best Rap Song",
    description: "Awarded to the songwriter(s) of the best rap song",
    outcomes: [
      "Anxiety - Doechii",
      "The Birds Don't Sing - Clipse, John Legend & Voices of Fire",
      "Sticky - Tyler, The Creator, GloRilla, Sexyy Red & Lil Wayne",
      "TGIF - GloRilla",
      "tv off - Kendrick Lamar & Lefty Gunplay",
    ],
  },
  {
    name: "Best Rap Performance",
    description: "Awarded to the best rap performance",
    outcomes: [
      "Outside - Cardi B",
      "Chains & Whips - Clipse, Pharrell Williams & Kendrick Lamar",
      "Anxiety - Doechii",
      "tv off - Kendrick Lamar & Lefty Gunplay",
      "Darling, I - Tyler, The Creator & Teezo Touchdown",
    ],
  },
  {
    name: "Best R&B Song",
    description: "Awarded to the songwriter(s) of the best R&B song",
    outcomes: [
      "Folded - Kehlani",
      "Heart Of A Woman - Summer Walker",
      "It Depends - Chris Brown & Bryson Tiller",
      "Overqualified - Durand Bernarr",
      "YES IT IS - Leon Thomas",
    ],
  },
  {
    name: "Best Rock Performance",
    description: "Awarded to the best rock performance",
    outcomes: [
      "U Should Not Be Doing That - Amyl and The Sniffers",
      "The Emptiness Machine - Linkin Park",
      "NEVER ENOUGH - Turnstile",
      "Mirtazapine - Hayley Williams",
      "Changes (Live From Villa Park) - YUNGBLUD feat. Nuno Bettencourt",
    ],
  },
  {
    name: "Best Alternative Music Album",
    description: "Awarded to the best alternative music album",
    outcomes: [
      "SABLE, fABLE - Bon Iver",
      "Songs Of A Lost World - The Cure",
      "DON'T TAP THE GLASS - Tyler, The Creator",
      "moisturizer - Wet Leg",
      "Ego Death At A Bachelorette Party - Hayley Williams",
    ],
  },
  {
    name: "Best Rock Song",
    description: "Awarded to the songwriter(s) of the best rock song",
    outcomes: [
      "As Alive As You Need Me To Be - Trent Reznor & Atticus Ross",
      "Caramel - Vessel & II",
      "Glum - Daniel James & Hayley Williams",
      "NEVER ENOUGH - Turnstile",
      "Zombie - YUNGBLUD",
    ],
  },
  {
    name: "Best R&B Performance",
    description: "Awarded to the best R&B performance",
    outcomes: [
      "YUKON - Justin Bieber",
      "It Depends - Chris Brown & Bryson Tiller",
      "Folded - Kehlani",
      "MUTT (Live From NPR's Tiny Desk) - Leon Thomas",
      "Heart Of A Woman - Summer Walker",
    ],
  },
  {
    name: "Best Dance/Electronic Album",
    description: "Awarded to the best dance/electronic album",
    outcomes: [
      "EUSEXUA - FKA twigs",
      "Ten Days - Fred again..",
      "Fancy That - PinkPantheress",
      "Inhale / Exhale - RÜFÜS DU SOL",
      "F--- U SKRILLEX - Skrillex",
    ],
  },
  {
    name: "Best Dance Pop Recording",
    description: "Awarded to the best dance pop recording",
    outcomes: [
      "Bluest Flame - Selena Gomez & benny blanco",
      "Abracadabra - Lady Gaga",
      "Midnight Sun - Zara Larsson",
      "Just Keep Watching - Tate McRae",
      "Illegal - PinkPantheress",
    ],
  },
  {
    name: "Songwriter Of The Year, Non-Classical",
    description: "Awarded to the songwriter of the year",
    outcomes: [
      "Amy Allen",
      "Edgar Barrera",
      "Jessie Jo Dillon",
      "Tobias Jesso Jr.",
      "Laura Veltz",
    ],
  },
  {
    name: "Best Metal Performance",
    description: "Awarded to the best metal performance",
    outcomes: [
      "Night Terror - Dream Theater",
      "Lachryma - Ghost",
      "Emergence - Sleep Token",
      "Soft Spine - Spiritbox",
      "BIRDS - Turnstile",
    ],
  },
  {
    name: "Best Dance/Electronic Recording",
    description: "Awarded to the best dance/electronic recording",
    outcomes: [
      "No Cap - Disclosure & Anderson .Paak",
      "Victory Lap - Fred again.., Skepta & PlaqueBoyMax",
      "SPACE INVADER - KAYTRANADA",
      "VOLTAGE - Skrillex",
      "End Of Summer - Tame Impala",
    ],
  },
  {
    name: "Best Progressive R&B Album",
    description: "Awarded to the best progressive R&B album",
    outcomes: [
      "BLOOM - Durand Bernarr",
      "Adjust Brightness - Bilal",
      "Love on Digital - Destin Conrad",
      "Access All Areas - FLO",
      "Come as You Are - Terrace Martin & Kenyon Dixon",
    ],
  },
  {
    name: "Best Traditional R&B Performance",
    description: "Awarded to the best traditional R&B performance",
    outcomes: [
      "Here We Are - Durand Bernarr",
      "UPTOWN - Lalah Hathaway",
      "LOVE YOU TOO - Ledisi",
      "Crybaby - SZA",
      "VIBES DON'T LIE - Leon Thomas",
    ],
  },
  {
    name: "Best Contemporary Country Album",
    description: "Awarded to the best contemporary country album",
    outcomes: [
      "Patterns - Kelsea Ballerini",
      "Snipe Hunter - Tyler Childers",
      "Evangeline vs. the Machine - Eric Church",
      "Beautifully Broken - Jelly Roll",
      "Postcards From Texas - Miranda Lambert",
    ],
  },
  {
    name: "Best Melodic Rap Performance",
    description: "Awarded to the best melodic rap performance",
    outcomes: [
      "Proud Of Me - Fridayy & Meek Mill",
      "Wholeheartedly - JID, Ty Dolla $ign & 6LACK",
      "luther - Kendrick Lamar & SZA",
      "WeMaj - Terrace Martin, Kenyon Dixon & Rapsody",
      "SOMEBODY LOVES ME - Drake & PARTYNEXTDOOR",
    ],
  },
  {
    name: "Best Alternative Music Performance",
    description: "Awarded to the best alternative music performance",
    outcomes: [
      "Everything Is Peaceful Love - Bon Iver",
      "Alone - The Cure",
      "Seein' Stars - Turnstile",
      "Mangetout - Wet Leg",
      "Parachute - Hayley Williams",
    ],
  },
  {
    name: "Best Traditional Pop Vocal Album",
    description: "Awarded to the best traditional pop vocal album",
    outcomes: [
      "Wintersongs - Laila Biali",
      "Who Believes in Angels? - Elton John & Brandi Carlile",
      "The Gift of Love - Jennifer Hudson",
      "Harlequin - Lady Gaga",
      "A Matter of Time - Laufey",
      "The Secret of Life: Partners Vol 2 - Barbra Streisand",
    ],
  },
  {
    name: "Best Country Solo Performance",
    description: "Awarded to the best country solo performance",
    outcomes: [
      "Nose On the Grindstone - Tyler Childers",
      "Good News - Shaboozey",
      "I Never Lie - Zach Top",
      "Somewhere Over Laredo - Lainey Wilson",
      "Bad As I Used To Be - Chris Stapleton",
    ],
  },
  {
    name: "Best Traditional Country Album",
    description: "Awarded to the best traditional country album (new category for 2026)",
    outcomes: [
      "Dollar a Day - Charley Crockett",
      "American Romance - Lukas Nelson",
      "Oh What a Beautiful World - Willie Nelson",
      "Hard Headed Woman - Margo Price",
      "Ain't in It for My Health - Zach Top",
    ],
  },
  {
    name: "Best Country Duo/Group Performance",
    description: "Awarded to the best country duo/group performance",
    outcomes: [
      "A Song to Sing - Miranda Lambert & Chris Stapleton",
      "Trailblazer - Reba McEntire, Miranda Lambert & Lainey Wilson",
      "Love Me Like You Used to Do - Margo Price & Tyler Childers",
      "Amen - Shaboozey & Jelly Roll",
      "Honky Tonk Hall of Fame - George Strait & Chris Stapleton",
    ],
  },
  {
    name: "Best Remixed Recording",
    description: "Awarded to the best remixed recording",
    outcomes: [
      "Abracadabra (Gesaffelstein Remix) - Lady Gaga",
      "Don't Forget About Us (KAYTRANADA Remix) - Mariah Carey",
      "A Dreams A Dream (Ron Trent Remix) - Soul II Soul",
      "Galvanize (Chris Lake Remix) - The Chemical Brothers",
      "Golden (David Guetta Remix) - HUNTR/X",
    ],
  },
  {
    name: "Best Spoken Word Poetry Album",
    description: "Awarded to the best spoken word poetry album",
    outcomes: [
      "Black Shaman - Marc Marcel",
      "Pages - Omari Hardwick & Anthony Hamilton",
      "A Hurricane in Heels - Queen Sheba",
      "Saul Williams Meets Carlos Niño & Friends - Saul Williams",
      "Words for Days, Vol - Skillz",
    ],
  },
];

function seedMarkets() {
  console.log("Starting market seed...\n");

  const insertMarket = db.prepare(`
    INSERT INTO markets (name, description, status)
    VALUES (?, ?, 'draft')
  `);

  const insertOutcome = db.prepare(`
    INSERT INTO outcomes (market_id, name, display_order)
    VALUES (?, ?, ?)
  `);

  let marketsCreated = 0;
  let outcomesCreated = 0;

  for (const market of markets) {
    try {
      const result = insertMarket.run(market.name, market.description);
      const marketId = result.lastInsertRowid;
      marketsCreated++;
      console.log(`Created market: ${market.name} (ID: ${marketId})`);

      for (let i = 0; i < market.outcomes.length; i++) {
        insertOutcome.run(marketId, market.outcomes[i], i);
        outcomesCreated++;
      }
      console.log(`  Added ${market.outcomes.length} nominees\n`);
    } catch (error) {
      console.error(`Error creating market "${market.name}":`, error);
    }
  }

  console.log("=".repeat(50));
  console.log(`Seed complete!`);
  console.log(`Markets created: ${marketsCreated}`);
  console.log(`Outcomes created: ${outcomesCreated}`);
  console.log("\nMarkets are in 'draft' status. Use the admin panel to:");
  console.log("1. Set initial odds for each market");
  console.log("2. Open markets for trading");
}

// Run the seed
seedMarkets();
db.close();
