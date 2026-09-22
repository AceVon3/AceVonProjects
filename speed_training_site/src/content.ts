// Product truth for the SPEED Training site. Every number, policy, quote,
// and destination here comes from the live Kartra page as of 2026-09-22.
// Do not add prices or claims that are not on that page. See PRODUCT.md.

export const links = {
  home: "https://app.kartra.com/redirect_to/?asset=page&id=PHRKYc6vZ4Za",
  pricing: "https://app.kartra.com/redirect_to/?asset=page&id=IhSs6KXnjgYf",
  onDemand: "https://app.kartra.com/redirect_to/?asset=page&id=ihzx2kRBCb9c",
  testimonials: "https://app.kartra.com/redirect_to/?asset=page&id=zG4uQt76gmrK",
  speakerBio: "https://app.kartra.com/redirect_to/?asset=page&id=gC3cLOrubnrK",
  instantAccess: "https://app.kartra.com/redirect_to/?asset=page&id=bKEJnD4pthdT",
  terms: "https://app.kartra.com/redirect_to/?asset=page&id=AODjLqPdK4Yf",
  privacy: "https://app.kartra.com/redirect_to/?asset=page&id=rUzYbaRZnO9c",
  login: "https://cloud.speedtrainingworkshop.com",
  facebookGroup: "https://www.facebook.com/groups/speedtrainingworkshop",
  facebookPage: "https://www.facebook.com/speedtrainingworkshop",
  support: "mailto:support@speedtrainingworkshop.com",
} as const;

export const assets = {
  logo: "https://d11n7da8rpqbjy.cloudfront.net/tmtrainer/31036445_1670368427jSzSPEED_Training.png",
  logoWebp: "https://d11n7da8rpqbjy.cloudfront.net/tmtrainer/31036445_1670368427jSzSPEED_Training.webp",
  squareMark: "https://d11n7da8rpqbjy.cloudfront.net/tmtrainer/31036373_1670276450cdWSPEED_Square.png",
  favicon: "https://kartrausers.s3.amazonaws.com/speedtraining/2_639538e259583_Square.jpg",
  workshopPhoto: "https://d11n7da8rpqbjy.cloudfront.net/tmtrainer/31036294_1670210524bVfwork.png",
  includedGraphic: "https://d11n7da8rpqbjy.cloudfront.net/speedtraining/602_16743560403Xr30303742_1661768072fHq06.png",
  onDemandLogo: "https://d11n7da8rpqbjy.cloudfront.net/speedtraining/755_1675204650RBJOn_Demand_Logo.png",
  heroPhoto: "https://d11n7da8rpqbjy.cloudfront.net/speedtraining/601_1674355259mM729585513_16587397237Vu13.jpg",
} as const;

export const video = {
  id: "OLQzXWC5byZa",
  scriptSrc:
    "https://app.kartra.com/video/OLQzXWC5byZa/zfbbd/?autoplay=false&mute_on_start=false&show_controls=true&skin=10&sticky=false&resume_playback=false",
} as const;

export const optin = {
  action: "https://app.kartra.com//process/add_lead/AywS5sPGOuXc",
  id: "AywS5sPGOuXc",
} as const;

export const stats = [
  { value: "4,000+", label: "Agents & team members nationwide", tool: "Coast to coast" },
  { value: "125+", label: "Done-for-you email templates", tool: "Outlook" },
  { value: "60+", label: "Built-in text scripts", tool: "SFConnect" },
  { value: "10+", label: "Years of staying power", tool: "Since 2015" },
] as const;

export const heroBullets = [
  "Save time on everyday customer communication with 125+ done-for-you email templates",
  "Respond faster with built-in text scripts your team can use immediately",
  "Keep your processes intact, even when team members come and go",
] as const;

export type Item = {
  code: string;
  name: string;
  limit: string;
  tool: string;
  description: string;
};

// "What's Included with SPEED", every item from the current page.
// `limit` is a count only where the page states one; otherwise blank.
export const included: Item[] = [
  {
    code: "01",
    name: "Email Templates",
    limit: "125+",
    tool: "Outlook",
    description: "Done-for-you messages for daily correspondence with current customers and prospects.",
  },
  {
    code: "02",
    name: "Custom Text Scripts",
    limit: "60+",
    tool: "SFConnect",
    description: "Copy and paste directly into SFConnect for late pays, signature forms, appointment confirmations, quotes, and more.",
  },
  {
    code: "03",
    name: "Follow Up Plans",
    limit: "",
    tool: "ECRM",
    description: "ECRM workflows so nothing slips through the cracks, including time frames, task step names, and descriptions.",
  },
  {
    code: "04",
    name: "Signatures",
    limit: "15+",
    tool: "Outlook",
    description: "Reply and forward professionally on every transaction.",
  },
  {
    code: "05",
    name: "SPEED Cloud",
    limit: "",
    tool: "Any browser",
    description: "All products in one place with always current email templates for you and your team.",
  },
  {
    code: "06",
    name: "Quote Delivery Ideas",
    limit: "10+",
    tool: "Quotes",
    description: "Look professional, bring value, no winging it.",
  },
  {
    code: "07",
    name: "Google Reviews",
    limit: "",
    tool: "Google Business",
    description: "Built-in scripts and links to your Google Business page so customers can easily leave a 5-star review.",
  },
  {
    code: "08",
    name: "On Demand Workshop",
    limit: "2 days",
    tool: "Video",
    description: "Most offices complete the On Demand workshop over 2 days. No travel, no time away from the office.",
  },
];

// The extras that ride along with the core system.
export const extras: Item[] = [
  {
    code: "E1",
    name: "Get up to SPEED",
    limit: "Daily",
    tool: "Email / video",
    description: "Daily emails and/or videos for personal development and culture building.",
  },
  {
    code: "E2",
    name: "BOD Trainer",
    limit: "",
    tool: "Guided tool",
    description: "A guided tool that walks your team through the BOD process step by step.",
  },
  {
    code: "E3",
    name: "SMPs",
    limit: "Automated",
    tool: "Task reminders",
    description: "Automated task reminders that send the right message at the right time.",
  },
  {
    code: "E4",
    name: "Get Better Newsletter",
    limit: "Daily",
    tool: "Email",
    description: "Daily emails with product knowledge and timely reminders to keep your agency sharp.",
  },
];

export const changes = [
  "Your team responds to customers faster, without wondering what to say",
  "Your communication stays consistent, regardless of who's handling it",
  "Your processes stay in place, even when people come and go",
  "New team members get up to speed in days, not months",
] as const;

export const steps = [
  {
    n: "1",
    title: "Watch the SPEED Workshop",
    body: "Learn the systems, workflows, and communication strategies used by high-performing agencies.",
  },
  {
    n: "2",
    title: "Start using the templates and workflows",
    body: "Most agencies begin using templates and scripts immediately after gaining access.",
  },
  {
    n: "3",
    title: "Run a better agency, every single day",
    body: "Your whole team works from the same system: consistent communication, fewer dropped balls, and processes that don't depend on any one person.",
  },
] as const;

export const testimonials = [
  {
    quote:
      "I’ve always believed in working “smart, not hard.” Sean’s training, processes, and templates have helped our team simplify workflows and maximize growth while reducing lapses and cancellations. This is something I wish I had implemented ten years ago. Every agent, from new TICAs to President’s Club agents, can benefit from what SPEED teaches.",
    who: "MDRT, Chairman’s Circle Agent",
    where: "Wyoming",
  },
  {
    quote:
      "As a Chairman’s Circle and MOA Agent that is “dialed in”…I felt pretty confident my processes were on point. After attending the workshop with my service manager I realized we were only half way there. Sean’s workshop is an excellent use of time and money. You will not be disappointed.",
    who: "Chairman’s Circle, MOA Agent",
    where: "Colorado",
  },
] as const;

export type Faq = { q: string; a: string[] };

export const faqs: Faq[] = [
  {
    q: "Is SPEED live or On Demand?",
    a: [
      "SPEED is On Demand, which means you and your team can start immediately and work through the material at your own pace, no waiting for a scheduled class.",
      "The program includes step-by-step video training, email templates, text scripts, and operational workflows designed specifically for insurance agencies. Many offices choose to implement the system gradually by watching a section, applying the processes in their daily work, and then continuing with the next module.",
      "Because the training is On Demand, new team members can also access the material later for onboarding and reinforcement, helping your agency maintain consistent communication and workflows over time.",
    ],
  },
  {
    q: "How do I access SPEED after signing up?",
    a: [
      "After signing up, you'll receive an email with your login instructions and can get started immediately.",
      "Your account provides access to the full training system, including video modules, email templates, text scripts, and supporting resources. Many agents choose to start by reviewing the core training and then gradually implementing the templates and workflows with their team.",
      "Because SPEED is delivered online, you and your team can return to the material anytime to review processes, onboard new team members, or reinforce best practices.",
    ],
  },
  {
    q: "Who should attend?",
    a: [
      "Everyone on your team who talks to customers. That's the short answer.",
      "Most agents start by reviewing the training themselves and then sharing the system with their team. Office managers, customer service representatives, and agent aspirants typically benefit the most because they handle the majority of day-to-day customer interactions.",
      "Any team member who responds to emails, speaks with customers on the phone, or assists with service requests can benefit from the templates, scripts, and workflows included in SPEED. Many agencies also use the training to help onboard new team members and ensure everyone communicates with customers in a consistent, professional way.",
    ],
  },
  {
    q: "Does the agent need to attend, or can I just send my team?",
    a: [
      "You can send your team first, but we strongly recommend the agent go through the core material too.",
      "SPEED introduces systems and workflows that often change how an agency handles everyday customer communication. When the agent understands the structure behind the templates and processes, it becomes much easier to support the team and implement the system consistently across the office.",
      "That said, many agencies begin by having their service team start using the templates and scripts right away, and then the agent reviews the training alongside them as the system is implemented.",
    ],
  },
  {
    q: "Can multiple team members access SPEED?",
    a: [
      "Yes. SPEED is designed to be used across your entire team.",
      "Many agencies give access to their office manager, customer service representatives, and agent aspirants so everyone who communicates with customers can use the same templates, scripts, and workflows.",
      "The more team members who use the same system, the more consistent your agency becomes, and the easier it is to onboard new hires down the road.",
    ],
  },
  {
    q: "I attended as a Team Member, and now I have my own agency. Is there a discount?",
    a: [
      "First, congratulations on opening your agency!",
      "While we don’t offer a discount based on prior attendance as a team member, many agents find that going through the training again as the agency owner provides a completely different perspective. SPEED focuses heavily on building systems and workflows across the entire office, which often becomes more valuable once you’re responsible for implementing those processes with your own team.",
      "Think of it as the best systems investment you'll make as a new agency owner.",
    ],
  },
  {
    q: "Is there a discount for brand new agents?",
    a: [
      "Congratulations on opening your agency!",
      "While we don’t offer a special discount for new agents, many find that implementing strong communication systems early makes a significant difference as their team grows. SPEED is designed to help agencies establish consistent workflows, professional customer communication, and scalable processes from the beginning.",
      "The agents who build systems early are the ones who scale fastest. SPEED is how you start right.",
    ],
  },
  {
    q: "Is there a discount for husband and wife agents?",
    a: [
      "Each agency needs its own account, and here's why.",
      "Each SPEED account is customized for a specific agency. The templates, images, and communication tools are configured so that emails and text messages are sent from the correct agent and align with that office’s workflows and customer relationships.",
      "Because of this customization, each agency requires its own SPEED account, even if the agents are married or operate agencies from the same location.",
    ],
  },
  {
    q: "Can I purchase the Email Templates and other course materials separately?",
    a: [
      "No. The email templates and other materials are part of the complete SPEED system and are not sold separately.",
      "Everything works together as a system, and that's exactly what makes it effective.",
    ],
  },
  {
    q: "Why might older SPEED Templates stop working over time?",
    a: [
      "SPEED templates are living tools, not static files, and that's what keeps them effective.",
      "Over the past several years, compliance requirements around email content and deliverability have increased significantly. As part of that, we've moved to a Cloud-based platform so content can be actively managed, updated, and removed as needed. That has included shutting down older hosted servers to ensure only current, compliant content remains available.",
      "Hosted assets, images, icons, and linked files, tied to inactive accounts are retired after a 2-year support window. Once removed, older template copies will stop displaying those elements correctly.",
      "If your templates have stopped working, the only path forward is an active SPEED Cloud subscription. Feel free to reach out at support@speedtrainingworkshop.com with any questions.",
    ],
  },
  {
    q: "Can I record the Workshop for training my team?",
    a: [
      "No. The SPEED training and materials may not be recorded, copied, or redistributed.",
      "SPEED is delivered through an online platform so your team can access the training directly, review specific modules as needed, and return to the material over time.",
      "This approach ensures everyone is always working from the most current templates, tools, and processes, not an outdated recording.",
    ],
  },
  {
    q: "How often is the content updated?",
    a: [
      "SPEED is updated continuously as technology, communication tools, and compliance standards evolve.",
      "Updates may include improvements to email templates, new scripts, refinements to workflows, and adjustments based on changes in ECRM systems or industry best practices. In some cases, certain elements may also be modified or retired to remain aligned with current platform requirements or compliance guidance.",
      "Because SPEED is delivered through an online platform, agencies with active access automatically receive the most current versions of the templates, tools, and training resources.",
    ],
  },
  {
    q: "Is SPEED approved by State Farm?",
    a: [
      "In short, agents and their team members are allowed to use our service.",
      "SPEED is a Non-State Farm Vendor, which is different from an Unauthorized Entity. If you're familiar with the difference between Vendors, Unauthorized Entities, and Non-State Farm Vendors, SPEED falls in the clear category. When in doubt, check with your leadership, but thousands of agents and team members across the country use SPEED without issue.",
      "We have no connectivity to State Farm systems and no customer or consumer information is ever shared.",
    ],
  },
];

export const disclaimer =
  "State Farm has not reviewed or approved this material, and neither supports or endorses the material presented. Additionally, State Farm makes no warranty regarding the accuracy or usability of the information contained in the presentation.";

export const copyright =
  "© Copyright by Sean Morton, Sean Morton Insurance Agency, Inc, SPEED Training. All Rights Reserved.";
