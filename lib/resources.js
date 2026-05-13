// ============================================================
// REBEL ENGINE — Resource Snapshot (lib/resources.js)
//
// Feeds verified content to the AI before every generation call.
// Prevents hallucination of URLs, project names, and brand facts.
//
// Audience: SME owners, e-commerce founders, service businesses
// in South Africa. Referral-led. Not technical.
//
// Each project/tool includes:
//   businessProblem      — the real problem it solves (plain language)
//   businessOutcome      — what changed for the business after it was built
//   contentHooks[]       — plain-language opening angles for SME posts
//   storyMoments[]       — human narrative angles for founder/showcase posts
//   antiHallucinationTerms[] — exact names/URLs the AI must use verbatim
//
// Last updated: 2026-05 — SME audience pivot
// ============================================================

const LIVE_URL = process.env.RESOURCES_SUMMARY_URL;

export async function fetchResourceSnapshot() {
  if (LIVE_URL) {
    try {
      const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "live", timestamp: new Date().toISOString() };
      }
    } catch {
      // Fall through to hardcoded snapshot
    }
  }

  return { ...SNAPSHOT, source: "hardcoded", timestamp: new Date().toISOString() };
}

// ─────────────────────────────────────────────────────────────
// HARDCODED SNAPSHOT
// Update whenever you add new work or services.
// ─────────────────────────────────────────────────────────────

const SNAPSHOT = {

  snapshotVersion: "2026-05-sme-pivot",

  // ── Live tools ───────────────────────────────────────────
  tools: [
    {
      name: "Password Roast",
      description: "A free security tool that tells you instantly whether a password is actually strong or just looks like it is. Works entirely in your browser — nothing gets sent anywhere.",
      url: "https://passwordroast.netlify.app",
      status: "production",

      businessProblem: "Business owners reuse weak passwords for their website, hosting, and payment accounts without realising the risk.",
      businessOutcome: "Free tool any business owner or their staff can use to check passwords without needing a tech background.",

      storyMoments: [
        "Built to give honest feedback instead of false reassurance",
        "Works in the browser — nothing ever gets sent to a server",
        "Free to use, no sign-up required",
      ],

      antiHallucinationTerms: [
        "Password Roast",
        "passwordroast.netlify.app",
      ],

      contentHooks: [
        "Most passwords that feel strong aren't. There's a free tool that tells you the truth.",
        "Your website password protects your whole business. It's worth checking it properly.",
        "This free tool checks passwords in your browser. Nothing gets sent anywhere.",
      ],
    },
  ],

  // ── Client projects & built products ──────────────────────
  projects: [
    {
      name: "Document Validation Engine",
      description: "A custom tool that automatically detects tampered PDF documents — the kind of proof-of-payment fraud that looks completely real to the human eye.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "production",
      category: "ai-tool",

      businessProblem: "South African businesses that accept proof-of-payment documents are exposed to fraud that visual inspection can't catch. A doctored PDF looks identical to a real one.",
      businessOutcome: "Automated detection catches tampered documents before money leaves the business. No technical knowledge required to use it.",

      storyMoments: [
        "Built for businesses that handle financial documents and can't afford to get it wrong",
        "The fraud it catches is the kind that looks perfectly real — until the money is gone",
        "Custom-built for this specific problem, not a generic tool",
      ],

      antiHallucinationTerms: [
        "Document Validation Engine",
        "rebeldesigns.co.za/Infrastructure",
      ],

      contentHooks: [
        "A fake proof of payment looks exactly like a real one. Until the money is gone.",
        "Businesses that accept proof-of-payment documents are exposed to fraud that the human eye cannot catch.",
        "This tool was built because visual inspection of PDFs is not enough. It never was.",
      ],
    },

    {
      name: "GameSir ZA",
      description: "A fully automated online store for a South African gaming peripherals brand. Orders come in, payments process, and fulfilment kicks off — without anyone needing to be there.",
      url: "https://gamesir.co.za",
      status: "production",
      category: "ecommerce",

      businessProblem: "The business needed to sell online without managing every order manually. WhatsApp orders and manual EFT confirmations don't scale.",
      businessOutcome: "The store handles orders, payments via Paystack, and fulfilment automatically. The owner's time is freed from order processing entirely.",

      storyMoments: [
        "Built to run without someone being available at every transaction",
        "Paystack integration means customers pay their way — no chasing EFT confirmations",
        "The goal was a store that works for the business owner, not one that creates more work",
      ],

      antiHallucinationTerms: [
        "GameSir ZA",
        "gamesir.co.za",
      ],

      contentHooks: [
        "This store processes orders and payments automatically. The owner doesn't touch every transaction.",
        "Selling online shouldn't mean being available every time someone wants to buy.",
        "GameSir ZA was built so the business can sell while the owner is doing something else.",
      ],
    },

    {
      name: "Autonomous Social Media Agent",
      description: "The automated content system running Rebel Designs' own Facebook and Instagram accounts. Generates posts, schedules them, and publishes — with a human approval step before anything goes live.",
      url: "https://rebeldesigns.co.za/Infrastructure",
      status: "production",
      category: "automation",

      businessProblem: "Posting consistently on social media takes time most business owners don't have. The result is inconsistent posting, or no posting at all.",
      businessOutcome: "Content is generated and published on a schedule without the business owner writing a single post. This is the exact system running these accounts.",

      storyMoments: [
        "Built to solve the problem it was designed to solve — and then used to run the accounts that talk about it",
        "Nothing posts without approval — the human step is the safeguard",
        "The system that generated this post is available to build for your business",
      ],

      antiHallucinationTerms: [
        "Autonomous Social Media Agent",
        "rebeldesigns.co.za/Infrastructure",
      ],

      contentHooks: [
        "This post was generated and published automatically. The system that did it can do the same for your business.",
        "Consistent social media doesn't require your time. It requires a system.",
        "The agent running these accounts is the same kind of tool we build for other businesses.",
      ],
    },

    {
      name: "Rebel Shap",
      description: "A WhatsApp quote-to-invoice automation tool for trades businesses. Sends quotes via WhatsApp, converts approvals to invoices, and follows up automatically.",
      url: "https://rebeldesigns.co.za",
      status: "production",
      category: "automation",

      businessProblem: "Tradespeople spend hours writing quotes, following up, and converting them to invoices manually. Most of it is repetitive work that shouldn't require their attention.",
      businessOutcome: "Quotes go out via WhatsApp. When a customer approves, the invoice is generated automatically. Follow-ups happen without anyone sending them.",

      storyMoments: [
        "Built for people who are too busy doing the work to chase the paperwork",
        "WhatsApp is where South African customers communicate — the tool meets them there",
        "The quote goes out in seconds. The follow-up happens automatically.",
      ],

      antiHallucinationTerms: [
        "Rebel Shap",
        "rebeldesigns.co.za",
      ],

      contentHooks: [
        "Sending quotes manually and following up by hand is a full day of work that shouldn't exist.",
        "WhatsApp is where South African customers actually respond. The quote should go there.",
        "Rebel Shap sends the quote, follows up, and generates the invoice. You just do the job.",
      ],
    },
  ],

  // ── Resources ─────────────────────────────────────────────
  resources: [
    {
      name: "The Loot Vault",
      description: "Free web tools, templates, and resources for South African businesses. Available to anyone, no sign-up required.",
      url: "https://rebeldesigns.co.za/resources",

      antiHallucinationTerms: [
        "The Loot Vault",
        "rebeldesigns.co.za/resources",
      ],

      contentHooks: [
        "Free tools and templates for South African businesses. No sign-up.",
        "The same build standard that goes into client work — available free.",
      ],
    },
  ],

  // ── Brand facts — use these exactly, never invent details ──
  brandFacts: {
    positioning: "Websites, online stores, and AI tools for South African businesses. Built from scratch, handed over completely.",
    tagline: "Most websites are built for launch day. We build for year five.",
    services: [
      "Websites and web apps — custom-built, not templates",
      "Online stores — Shopify and custom e-commerce with local payment options",
      "WhatsApp chatbots — automated inquiry handling and lead qualification",
      "Social media agents — automated content generation and publishing",
      "Custom AI tools — anything repetitive in a business that can be automated",
    ],
    ownershipPolicy: "Clients own their website completely. Code, domain, hosting access — all handed over at the end. No lock-in.",
    engagementModel: "Direct communication. No outsourcing. Fixed scope, fixed price. Response within 2 business days.",
    southAfricanContext: "Built for South African businesses. Local payment providers, mobile-first, WhatsApp-aware.",
    location: "South Africa",
    website: "rebeldesigns.co.za",
    resourcesPage: "rebeldesigns.co.za/resources",
    // contact details intentionally excluded — not needed by AI generation layer
    // POPIA: prevents real contact info from being passed to third-party AI operators
  },
};
