import fs from "fs";
import { fileURLToPath } from "url"; import path from "path";
const S = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
const A = "https://faithworks.vercel.app/assets/images/";
const P = "font-family:Poppins,'Avenir Next',Avenir,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const I = "font-family:Inter,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const INK = "color:#1A1A1A;";
const res = [
 { t:"Build Your Own AI Research Assistant With Gemini Notebook (Formerly NotebookLM)", u:"https://faithph.ai/resources?use-notebooklm-ai-research-assistant", img:A+"resources/use-notebooklm-ai-research-assistant.png?v=5706992", k:"Guide · Tutorials", d:"A beginner-friendly NotebookLM tutorial, updated for Gemini Notebook: add trusted sources, ask focused questions, check every citation and turn your reading into a briefing someone can use." },
 { t:"What Should You Never Give to AI?", u:"https://faithph.ai/resources?what-not-to-share-with-ai", img:A+"resources/what-not-to-share-with-ai.png", k:"Article · AI Fundamentals", d:"Treat anything you send to an AI tool as if you had put it on a public billboard. What never to paste into ChatGPT, Claude or Gemini, how your data is handled, and simple ways to redact first." },
 { t:"A Learning Rhythm That Fits Real Life", u:"https://faithph.ai/resources?a-learning-rhythm-that-fits-real-life", img:A+"web/talk-laptops-1280.webp", k:"Article · Lifestyle", d:"You don’t need whole days. Short, regular sessions tied to real work add up." },
 { t:"Chatbot, Copilot, or AI Agent: Which Do You Actually Need?", u:"https://faithph.ai/resources?chatbot-vs-copilot-vs-ai-agent", img:A+"resources/chatbot-vs-copilot-vs-ai-agent.png?v=fe1e4b1", k:"Guide · Tool Guides", d:"A plain-English guide to the difference between chatbots, copilots and AI agents, with real examples from ChatGPT, Claude, Gemini, Grok, Codex, OpenClaw and Hermes Agent, and a simple way to choose." },
];
const ev = [
 { m:"NOV", day:"6", wd:"FRI", t:"How I Work Better with Grok: Free Webinar", u:"https://faithph.ai/workshops", cta:"Event details", img:A+"events/grok-webinar-2026.png", when:"7:00 – 10:00 PM (Manila)", loc:"Online via Zoom", d:"Faith’s practical Grok workflows for business, content and learning: research and AI updates, LinkedIn and B2B growth, content, workshops, offers, websites, events and bot planning. Free, live on Zoom." },
 { m:"NOV", day:"7", wd:"SAT", t:"Recruitment Reimagined: Build Your Own Talent Acquisition Engine", u:"https://docs.google.com/forms/d/e/1FAIpQLSc4cVUT2Pp4amUsBdj7Ih9sPUYHc-wOm-qMOTtt3dJhGYXFsg/viewform", cta:"Register", img:A+"events/recruitment-reimagined-poster.png", when:"2:00 – 4:00 PM (Manila)", loc:"Online via GMeet, YouTube, Facebook and LinkedIn Live", d:"The 129th HR E-Knowledge Learning Series by HR Game Changers, in partnership with Faith Works and Digital GrowthScale, with Faith Natividad." },
 { m:"NOV", day:"14", wd:"SAT", t:"The Top 40 Filipino Founders on LinkedIn 2025: Awarding Ceremony and Collection Launch", u:"https://thetop40filipinofounders.netlify.app/", cta:"Register", img:A+"events/top-40-founders-2026.png", when:"12:00 – 6:00 PM (Manila)", loc:"House of Transformation, Ayala Malls The 30th, Pasig City", d:"An afternoon honoring the 40 Filipino founders on the 2025 list, with the launch of the Founders Collection. Presented by UnCapped Digital and Faith Works." },
 { m:"NOV", day:"15", wd:"SUN", t:"AI & Business Caravan: Singapore + Sydney", u:"https://faithph.ai/workshops", cta:"Event details", img:A+"events/ai-business-caravan.png", when:"Nov 15 – Dec 2", loc:"Singapore and Sydney (Faith Works Community members)", d:"A Faith Works Community trip to learn AI ideas we can bring home, connect with people for business and career growth, and grow together." },
];
const ICON = "https://faithworks.vercel.app/assets/email/";
const iconRow = (icon, html, style, mb = 8) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${mb}px 0;"><tr><td width="24" valign="middle" style="width:24px;"><img src="${ICON}${icon}" width="24" height="24" alt="" style="display:block;width:24px;height:24px;"></td><td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td><td valign="middle" style="${style}">${html}</td></tr></table>`;
const esc = (s) => s.replace(/&/g,"&amp;");
const eyebrow = (txt, accent) => `<p style="margin:0 0 6px 0;${P}font-size:12px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;${INK}">${txt}</p>`;
const link = (u, txt) => `<a href="${esc(u)}" target="_blank" style="${P}font-size:15px;line-height:22px;font-weight:600;${INK}text-decoration:underline;">${txt}</a>`;
const btn = (u, txt) => `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(u)}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="16%" stroke="f" fillcolor="#FBC522"><center style="color:#1A1A1A;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${txt}</center></v:roundrect><![endif]--><!--[if !mso]><!-- --><a href="${esc(u)}" target="_blank" style="display:inline-block;background-color:#FBC522;${INK}${P}font-size:16px;font-weight:600;line-height:20px;text-decoration:none;padding:15px 30px;border-radius:8px;">${txt}</a><!--<![endif]-->`;
const resRow = (r) => `
<tr><td style="padding:28px 0;border-top:1px solid #E6E1D8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="fw-stack fw-thumb" width="200" valign="top" style="width:200px;"><a href="${esc(r.u)}" target="_blank"><img src="${esc(r.img)}" width="200" alt="${esc(r.t)}" style="display:block;width:200px;max-width:100%;height:auto;border-radius:10px;"></a></td>
    <td class="fw-stack fw-gap" width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>
    <td class="fw-stack" valign="top">
      ${iconRow("icon-book-yellow.png", r.k, `${I}font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;${INK}`, 10)}
      <h3 style="margin:0 0 8px 0;${P}font-size:18px;line-height:25px;font-weight:600;${INK}"><a href="${esc(r.u)}" target="_blank" style="${INK}text-decoration:none;">${esc(r.t)}</a></h3>
      <p style="margin:0 0 10px 0;${I}font-size:15px;line-height:23px;${INK}">${r.d}</p>
      ${link(r.u, "Read more")}
    </td>
  </tr></table>
</td></tr>`;
const evRow = (e, i) => `
<tr><td style="padding:${i ? "24px" : "0"} 0 24px 0;${i ? "border-top:1px solid #E6E1D8;" : ""}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="fw-stack fw-thumb" width="180" valign="top" style="width:180px;"><a href="${esc(e.u)}" target="_blank"><img src="${esc(e.img)}" width="180" alt="${esc(e.t)}" style="display:block;width:180px;max-width:100%;height:auto;border-radius:10px;"></a></td>
    <td class="fw-stack fw-gap" width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>
    <td class="fw-stack" valign="top">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr>
        <td bgcolor="#EFACBA" style="background-color:#EFACBA;border-radius:6px;padding:6px 10px;${P}font-size:12px;line-height:14px;font-weight:600;letter-spacing:1.5px;${INK}">${e.wd} · ${e.m} ${e.day}</td>
      </tr></table>
      <h3 style="margin:0 0 6px 0;${P}font-size:18px;line-height:25px;font-weight:600;${INK}"><a href="${esc(e.u)}" target="_blank" style="${INK}text-decoration:none;">${esc(e.t)}</a></h3>
      ${iconRow("icon-clock-pink.png", e.when, `${I}font-size:14px;line-height:20px;font-weight:600;${INK}`, 6)}${iconRow("icon-pin-yellow.png", esc(e.loc), `${I}font-size:14px;line-height:20px;font-weight:600;${INK}`, 10)}
      <p style="margin:0 0 10px 0;${I}font-size:15px;line-height:23px;${INK}">${e.d}</p>
      ${link(e.u, e.cta)}
    </td>
  </tr></table>
</td></tr>`;

const build = (res, ev) => { const lead = res[0]; return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>Faith Works Newsletter</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Poppins:wght@600&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  @media only screen and (max-width:620px) {
    .fw-pad { padding-left:22px !important; padding-right:22px !important; }
    .fw-h1 { font-size:28px !important; line-height:36px !important; }
    .fw-stack { display:block !important; width:100% !important; }
    .fw-thumb img { width:100% !important; }
    .fw-gap { height:14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F4;">
<!-- Preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#FAF8F4;">Build an AI research assistant you can trust, learn what never to paste into AI, and join us live this month.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF8F4" style="background-color:#FAF8F4;">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

  <!-- 1. HEADER -->
  <tr><td bgcolor="#1A1A1A" class="fw-pad" style="background-color:#1A1A1A;border-radius:16px 16px 0 0;padding:26px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle"><a href="https://faithph.ai/" target="_blank"><img src="https://faithworks.vercel.app/assets/email/wordmark-reversed.png" width="150" alt="Faith Works" style="display:block;width:150px;height:auto;"></a></td>
    </tr></table>
  </td></tr>

  <!-- 2. INTRODUCTION (written in GHL per send; the feed carries no copy) -->
  <tr><td bgcolor="#FFFFFF" class="fw-pad" style="background-color:#FFFFFF;padding:44px 40px 12px 40px;">
    ${eyebrow("This week", "#FBC522")}
    <h1 class="fw-h1" style="margin:8px 0 18px 0;${P}font-size:34px;line-height:42px;font-weight:600;${INK}">Think better with AI, then put it to work.</h1>
    <p style="margin:0 0 16px 0;${I}font-size:16px;line-height:26px;${INK}">Hi {{contact.first_name}},</p>
    <p style="margin:0 0 16px 0;${I}font-size:16px;line-height:26px;${INK}">This week is about using AI with judgment. Start by turning your own reading into a research assistant you can check, and learn the few things you should never paste into a chatbot. If you’re still sorting out the jargon, there’s a plain-English guide to chatbots, copilots and agents.</p>
    <p style="margin:0 0 8px 0;${I}font-size:16px;line-height:26px;${INK}">Then come learn with us live: a free Grok webinar on Friday, an HR session on building your own talent engine, and an afternoon celebrating Filipino founders.</p>
  </td></tr>

  <!-- 3. FEATURED RESOURCES: lead item + rows (RSS category = Resource, newest first) -->
  <tr><td bgcolor="#FFFFFF" class="fw-pad" style="background-color:#FFFFFF;padding:32px 40px 8px 40px;">
    ${eyebrow("Featured resources", "#FBC522")}
    <h2 style="margin:6px 0 22px 0;${P}font-size:24px;line-height:32px;font-weight:600;${INK}">New to read this week</h2>
    <a href="${esc(lead.u)}" target="_blank"><img src="${esc(lead.img)}" width="520" alt="${esc(lead.t)}" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;"></a>
    <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>${iconRow("icon-book-yellow.png", lead.k, `${I}font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;${INK}`, 10)}
    <h3 style="margin:0 0 10px 0;${P}font-size:22px;line-height:30px;font-weight:600;${INK}"><a href="${esc(lead.u)}" target="_blank" style="${INK}text-decoration:none;">${esc(lead.t)}</a></h3>
    <p style="margin:0 0 20px 0;${I}font-size:16px;line-height:26px;${INK}">${lead.d}</p>
    ${btn(lead.u, "Read the guide")}
    <div style="height:36px;line-height:36px;font-size:0;">&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${res.slice(1).map(resRow).join("")}</table>
  </td></tr>

  <!-- 4. UPCOMING EVENTS (RSS category = Event, soonest first) -->
  <tr><td bgcolor="#FAF8F4" class="fw-pad" style="background-color:#FAF8F4;padding:40px 40px 16px 40px;border-left:1px solid #EFE9DF;border-right:1px solid #EFE9DF;">
    ${eyebrow("Upcoming workshops &amp; events", "#EFACBA")}
    <h2 style="margin:6px 0 24px 0;${P}font-size:24px;line-height:32px;font-weight:600;${INK}">Learn with us, live</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${ev.map(evRow).join("")}</table>
  </td></tr>

  <!-- 5. CLOSING -->
  <tr><td bgcolor="#FFFFFF" class="fw-pad" align="center" style="background-color:#FFFFFF;padding:44px 40px 48px 40px;">
    <h2 style="margin:0 0 12px 0;${P}font-size:24px;line-height:32px;font-weight:600;${INK}">Keep learning at your own pace</h2>
    <p style="margin:0 0 24px 0;${I}font-size:16px;line-height:26px;${INK}">Every guide in the library is free, written in plain English and made for real work. Pick one, try it this week, and tell us how it went.</p>
    ${btn("https://faithph.ai/resources", "Explore all resources")}
    <p style="margin:22px 0 0 0;">${link("https://faithph.ai/workshops", "See all workshops")}</p>
    <p style="margin:32px 0 0 0;${I}font-size:16px;line-height:26px;${INK}">Learning with you,<br><span style="${P}font-weight:600;">Faith Works PH</span></p>
  </td></tr>

  <!-- 6. FOOTER -->
  <tr><td bgcolor="#1A1A1A" align="center" style="background-color:#1A1A1A;border-radius:0 0 16px 16px;padding:40px 24px;">
    <a href="https://faithph.ai/" target="_blank"><img src="https://faithworks.vercel.app/assets/email/wordmark-reversed.png" width="140" alt="Faith Works" style="display:block;width:140px;height:auto;margin:0 auto;"></a>
    <p style="margin:24px 0 14px 0;${P}font-size:12px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#EFACBA;">Follow &amp; join the community</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
      <td style="padding:0 6px;"><a href="https://www.facebook.com/profile.php?id=61580485384062" target="_blank"><img src="https://faithworks.vercel.app/assets/email/social-facebook.png" width="40" height="40" alt="Facebook" style="display:block;width:40px;height:40px;"></a></td>
      <td style="padding:0 6px;"><a href="https://www.instagram.com/faithworksph_/" target="_blank"><img src="https://faithworks.vercel.app/assets/email/social-instagram.png" width="40" height="40" alt="Instagram" style="display:block;width:40px;height:40px;"></a></td>
      <td style="padding:0 6px;"><a href="https://www.linkedin.com/in/faithnatividad/" target="_blank"><img src="https://faithworks.vercel.app/assets/email/social-linkedin.png" width="40" height="40" alt="LinkedIn" style="display:block;width:40px;height:40px;"></a></td>
      <td style="padding:0 6px;"><a href="https://www.facebook.com/share/g/1DGeoshBNh/" target="_blank"><img src="https://faithworks.vercel.app/assets/email/social-community.png" width="40" height="40" alt="Community group" style="display:block;width:40px;height:40px;"></a></td>
    </tr></table>
    <p style="margin:26px 0 0 0;${I}font-size:13px;line-height:21px;color:#FAF8F4;"><a href="https://faithph.ai/" target="_blank" style="color:#FAF8F4;text-decoration:underline;">faithph.ai</a></p>
    <p style="margin:14px 0 0 0;${I}font-size:12px;line-height:19px;color:#FAF8F4;">You’re receiving this because you subscribed to Faith Works updates.</p>
    <p style="margin:10px 0 0 0;${I}font-size:12px;line-height:19px;color:#FAF8F4;"><a href="{{email.unsubscribe_link}}" target="_blank" style="color:#FAF8F4;text-decoration:underline;">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`; };
const html = build(res, ev);
const R = (n) => ({ t:"[RESOURCE "+n+" TITLE]", u:"[RESOURCE "+n+" LINK]", img:"[RESOURCE "+n+" IMAGE URL]", k:"[RESOURCE "+n+" TYPE · CATEGORY]", d:"[RESOURCE "+n+" SUMMARY]" });
const E = (n) => ({ wd:"[DAY]", m:"[MON]", day:"[DATE]", t:"[EVENT "+n+" TITLE]", u:"[EVENT "+n+" LINK]", cta:"[Register / Event details]", img:"[EVENT "+n+" IMAGE URL]", when:"[EVENT "+n+" TIME]", loc:"[EVENT "+n+" LOCATION]", d:"[EVENT "+n+" SUMMARY]" });
const fields = build([1,2,3,4].map(R), [1,2,3,4].map(E))
  .replace(/(<div style="display:none[^>]*>)[^&]*/, "$1[PREVIEW TEXT]")
  .replace("Think better with AI, then put it to work.", "[HEADLINE]")
  .replace(/This week is about using AI with judgment.[^<]*/, "[INTRO PARAGRAPH 1: what this week’s resources help with]")
  .replace(/Then come learn with us live:[^<]*/, "[INTRO PARAGRAPH 2: the upcoming events in one sentence]");
fs.writeFileSync(S + "/12-newsletter-rss-fields.html", fields);
fs.writeFileSync(S + "/12-newsletter-rss-template.html", html);
fs.writeFileSync(S + "/12-newsletter-rss-preview.html", html
  .replace("{{contact.first_name}}", "Gabrielle")
  .replaceAll(ICON + "icon-", "../assets/email/icon-")
  .replace("{{location.name}} · {{location.full_address}}", "Faith Works · [business address, filled by GHL]")
  .replace("{{email.unsubscribe_link}}", "#"));
console.log("ok", html.length);
