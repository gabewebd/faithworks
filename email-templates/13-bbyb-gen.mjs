// Build Your Breakthrough 2027 — email set (GHL). Run: node 13-bbyb-gen.mjs
// Writes 13-bbyb-NN-*.html next to this file + 13-bbyb-preview.html
import fs from "fs";
import { fileURLToPath } from "url"; import path from "path";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSET = "https://faithworks.vercel.app/assets/email/";
const SITE = "https://faithph.ai/";
const MAIL = "faith@digitalgrowthscale.com";
const REG = "https://faithworks-breakthrough2027.netlify.app/register/";
const P = "font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const I = "font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;";

const p = (html, mb = 18) => `<p class="fw-text" style="margin:0 0 ${mb}px 0;${I}font-size:16px;line-height:26px;color:#1A1A1A;">${html}</p>`;
const greet = (h) => `<h1 class="fw-greet" style="margin:0 0 26px 0;${P}font-size:30px;line-height:44px;font-weight:600;letter-spacing:-0.5px;color:#1A1A1A;"><span style="background-color:#EFACBA;padding:2px 10px;border-radius:6px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">${h}</span></h1>`;
const b = (t) => `<strong style="${P}font-weight:600;">${t}</strong>`;
const btn = (href, txt) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px 0;"><tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:320px;" arcsize="15%" stroke="f" fillcolor="#FBC522"><w:anchorlock/><center style="color:#1A1A1A;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${txt}</center></v:roundrect><![endif]--><!--[if !mso]><!-- --><a class="fw-btn" href="${href}" target="_blank" style="display:inline-block;background-color:#FBC522;color:#1A1A1A;${P}font-size:16px;font-weight:600;line-height:20px;text-decoration:none;padding:16px 32px;border-radius:8px;mso-hide:all;">${txt}</a><!--<![endif]-->
</td></tr></table>`;
const contact = `<a href="mailto:${MAIL}" style="color:#1A1A1A;text-decoration:underline;">${MAIL}</a>`;
const sign = `<p class="fw-text" style="margin:8px 0 0 0;${I}font-size:16px;line-height:26px;color:#1A1A1A;"><span style="${P}font-weight:600;">Faith Works PH</span></p>`;
// Ticket details: label / value rows (hairlines, no card background so dark mode stays readable)
const details = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;border-top:1px solid #D9D3C7;">${rows.map(([l, v]) => `<tr><td class="fw-text" width="40%" valign="top" style="padding:12px 0;border-bottom:1px solid #D9D3C7;${I}font-size:13px;line-height:20px;letter-spacing:1px;text-transform:uppercase;color:#1A1A1A;">${l}</td><td class="fw-text" valign="top" style="padding:12px 0;border-bottom:1px solid #D9D3C7;${P}font-size:16px;line-height:22px;font-weight:600;color:#1A1A1A;">${v}</td></tr>`).join("")}</table>`;
// "What's included" rows with yellow tick bars
const list = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">${items.map((t, i) => `<tr><td width="6" valign="top" style="width:6px;padding:0 0 ${i < items.length - 1 ? 14 : 0}px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="6" height="26" bgcolor="#FBC522" style="width:6px;height:26px;background-color:#FBC522;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td width="16" style="width:16px;font-size:0;line-height:0;">&nbsp;</td><td class="fw-text" valign="top" style="padding:0 0 ${i < items.length - 1 ? 14 : 0}px 0;${I}font-size:16px;line-height:26px;color:#1A1A1A;">${t}</td></tr>`).join("")}</table>`;

// Header: black logo bar, then the event details on the page (no card): headline, 2027 chip, three outlined tiles
const tile = (icon, label, v1, v2) => `<td class="fw-tile" width="32%" valign="top" align="center" style="width:32%;border:2px solid #EFACBA;border-radius:12px;padding:16px 8px;text-align:center;"><img src="${ASSET}${icon}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;margin:0 auto 10px auto;"><p class="fw-text" style="margin:0 0 6px 0;${I}font-size:11px;line-height:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;">${label}</p><p class="fw-text" style="margin:0;${P}font-size:15px;line-height:21px;font-weight:600;color:#1A1A1A;">${v1}<br>${v2}</p></td>`;
const gap = `<td class="fw-gap" width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>`;
const header = `
          <tr>
            <td style="padding:0 0 34px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1A1A" style="border-collapse:separate;border-radius:16px;background-color:#1A1A1A;">
                <tr><td align="center" bgcolor="#1A1A1A" style="padding:26px 24px;background-color:#1A1A1A;border-radius:16px;">
                  <a href="${SITE}" target="_blank" style="text-decoration:none;"><img src="${ASSET}wordmark-reversed.png" width="168" height="34" alt="Faith Works" style="display:block;width:168px;height:auto;"></a>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 0 34px 0;">
              <p class="fw-text" style="margin:0 0 14px 0;${I}font-size:12px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;">Stop collecting prompts. Start applying AI.</p>
              <h2 class="fw-greet fw-hdtitle" style="margin:0;${P}font-size:36px;line-height:52px;font-weight:600;letter-spacing:-0.5px;color:#1A1A1A;">Build Your Breakthrough<br><span style="background-color:#FBC522;color:#1A1A1A;padding:2px 18px;border-radius:999px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">2027</span></h2>
              <p class="fw-text" style="margin:16px 0 22px 0;${I}font-size:16px;line-height:24px;color:#1A1A1A;">5 Practical Steps to Grow with AI &middot; with Coach Faith Natividad</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
                ${tile("icon-calendar-pink.png", "Date", "Nov 16, 2026", "Monday")}${gap}${tile("icon-clock-pink.png", "Time", "7:00 &ndash; 10:00 PM", "PHT")}${gap}${tile("icon-video-pink.png", "Where", "Live via", "Zoom")}
              </tr></table>
            </td>
          </tr>`;

const footer = `
    <tr>
      <td align="center" class="fw-footwrap fw-bg" bgcolor="#FFFFFF" style="padding:0 24px 40px 24px;background-color:#FFFFFF;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1A1A" style="width:100%;max-width:600px;border-collapse:separate;border-radius:16px;overflow:hidden;background-color:#1A1A1A;">
          <tr><td style="padding:0;font-size:0;line-height:0;border-radius:16px 16px 0 0;overflow:hidden;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" height="4" bgcolor="#EFACBA" style="background-color:#EFACBA;height:4px;font-size:0;line-height:0;">&nbsp;</td><td width="50%" height="4" bgcolor="#FBC522" style="background-color:#FBC522;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
          <tr>
            <td align="center" bgcolor="#1A1A1A" class="fw-foot" style="background-color:#1A1A1A;padding:40px 24px;border-radius:0 0 16px 16px;">
              <a href="${SITE}" target="_blank" style="text-decoration:none;"><img src="${ASSET}wordmark-reversed.png" width="140" height="28" alt="Faith Works" style="display:block;width:140px;height:auto;"></a>
              <p style="margin:28px 0 14px 0;${P}font-size:12px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#EFACBA;">Follow &amp; join the community</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="padding:0 6px;"><a href="https://www.facebook.com/profile.php?id=61580485384062" target="_blank" style="text-decoration:none;"><img src="${ASSET}social-facebook.png" width="40" height="40" alt="Facebook" style="display:block;width:40px;height:40px;"></a></td><td style="padding:0 6px;"><a href="https://www.instagram.com/faithworksph_/" target="_blank" style="text-decoration:none;"><img src="${ASSET}social-instagram.png" width="40" height="40" alt="Instagram" style="display:block;width:40px;height:40px;"></a></td><td style="padding:0 6px;"><a href="https://www.linkedin.com/in/faithnatividad/" target="_blank" style="text-decoration:none;"><img src="${ASSET}social-linkedin.png" width="40" height="40" alt="LinkedIn" style="display:block;width:40px;height:40px;"></a></td><td style="padding:0 6px;"><a href="https://www.facebook.com/share/g/1DGeoshBNh/" target="_blank" style="text-decoration:none;"><img src="${ASSET}social-community.png" width="40" height="40" alt="Community group" style="display:block;width:40px;height:40px;"></a></td></tr></table>
              <p style="margin:28px 0 0 0;${I}font-size:13px;line-height:20px;color:#FAF8F4;"><a href="${SITE}" target="_blank" style="color:#FAF8F4;text-decoration:underline;">faithph.ai</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

const page = (title, h, body) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Poppins:wght@600&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, .fw-bg { margin:0; padding:0; width:100% !important; background-color:#FFFFFF !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    /* Dark mode: dark ground, light text; yellow and pink stay, logo bar and footer are charcoal; event details sit on the page. */
    @media (prefers-color-scheme: dark) {
      body, .fw-bg { background-color:#262626 !important; }
      .fw-greet, .fw-text, .fw-text span, .fw-text strong, .fw-text a { color:#FAF8F4 !important; }
      .fw-greet span, .fw-btn { color:#1A1A1A !important; }
    }
    [data-ogsc] body, [data-ogsc] .fw-bg { background-color:#262626 !important; }
    [data-ogsc] .fw-greet, [data-ogsc] .fw-text, [data-ogsc] .fw-text span, [data-ogsc] .fw-text strong, [data-ogsc] .fw-text a { color:#FAF8F4 !important; }
    [data-ogsc] .fw-greet span, [data-ogsc] .fw-btn { color:#1A1A1A !important; }
    @media only screen and (max-width:620px) {
      .fw-main { padding:32px 22px 40px 22px !important; }
      .fw-greet { font-size:26px !important; line-height:38px !important; }
      .fw-hdtitle { font-size:28px !important; line-height:42px !important; }
      .fw-tile { display:block !important; width:100% !important; box-sizing:border-box; margin-bottom:10px; }
      .fw-gap { display:none !important; }
      .fw-foot { padding:32px 20px !important; }
      .fw-footwrap { padding:0 22px 32px 22px !important; }
    }
  </style>
</head>
<body class="fw-bg" bgcolor="#FFFFFF" style="margin:0;padding:0;background-color:#FFFFFF;">
  <table role="presentation" class="fw-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;">
    <tr>
      <td align="center" class="fw-main fw-bg" bgcolor="#FFFFFF" style="padding:40px 24px 48px 24px;background-color:#FFFFFF;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">${header}
          <tr>
            <td>
              ${greet(h)}
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>${footer}
  </table>
</body>
</html>
`;

const zoom = `Monday, November 16, 2026, from 7:00 to 10:00 PM PHT`;
const ID = `{{contact.fw27_registration_id}}`;
const ticketBox = details([["Ticket", "{{contact.fw27_ticket}}"], ["Amount", "₱{{contact.fw27_amount}}"], ["Registration ID", ID]]);
const payHow = `Pay by GCash or MariBank QR, then upload your receipt screenshot and reference number.`;

const emails = [
  { f: "01-payment-confirmed-plus", h: "You're in. Let's build your breakthrough.", name: "Payment Confirmed — Breakthrough Plus", subject: "You're in! Welcome to Breakthrough Plus", pre: "Replay, workbook, starter kits, prompts, planner and the group implementation clinic.",
    body: p("Thank you for choosing <strong style=\"" + P + "font-weight:600;\">Breakthrough Plus</strong>. Your payment is confirmed and your seat is saved.") +
      p("Our team will share access to everything that comes with your ticket:", 16) +
      list(["The full session replay", "Your workbook and starter kits", "The prompt pack and planner", "The group implementation clinic"]) +
      p("Your Zoom details for the live session will arrive in a separate email.") +
      p(`Questions? Just reply or write to ${contact}.`) + sign },
  { f: "02-payment-confirmed-live", h: "Your seat is confirmed!", name: "Payment Confirmed — Live Access", subject: "You're in! See you on Zoom", pre: "Your Live Access seat is confirmed.",
    body: p("Thank you for registering. Your payment is confirmed and your <strong style=\"" + P + "font-weight:600;\">Live Access</strong> seat is saved. We're so happy to have you.") +
      p("Here's what to expect:", 16) +
      list(["A live 3-hour Zoom webinar with Coach Faith", "A worksheet to apply each step as we go", "A Q&A session to get your questions answered"]) +
      p("Watch your inbox for your Zoom link and session schedule.") +
      p(`Questions? Reply to this email or write to ${contact}.`) +
      p("See you inside!", 8) + sign },
  { f: "03-reminder-tomorrow", h: "Tomorrow, your breakthrough begins.", name: "Reminder — Tomorrow", subject: "Tomorrow: Build Your Breakthrough 2027", pre: "Live on Zoom, Monday, 7:00 to 10:00 PM PHT.",
    body: p(`See you tomorrow! <strong style="${P}font-weight:600;">Build Your Breakthrough 2027</strong> goes live on Zoom on ${zoom}.`) +
      p(`Use the Zoom details in your <strong style="${P}font-weight:600;">Payment Confirmed</strong> email to join. It's worth saving the link and setting a reminder now.`) +
      p(`Questions? Write to ${contact}.`) + sign },
  { f: "04-reminder-one-hour", h: "One hour to go. Let's do this!", name: "Reminder — Starts in 1 Hour", subject: "Starting in 1 hour: Build Your Breakthrough 2027", pre: "Grab your Zoom link and get ready.",
    body: p(`We're starting in <strong style="${P}font-weight:600;">one hour</strong>! Build Your Breakthrough 2027 is live on Zoom today, ${zoom}.`) +
      p(`Your Zoom details are in your <strong style="${P}font-weight:600;">Payment Confirmed</strong> email. Open it now so you can join right on time.`) +
      p(`Questions? Write to ${contact}.`) + sign },
  { f: "05-unpaid-reminder-1", h: "Your breakthrough is waiting.", name: "Unpaid — Reminder 1", subject: "Your seat isn't reserved yet", pre: "Complete your payment to hold your spot.",
    body: p(`A friendly reminder: your seat for Build Your Breakthrough 2027 is <strong style="${P}font-weight:600;">not reserved until payment is completed</strong>.`) +
      ticketBox +
      p(`Head back to your registration on the same phone or browser you used, so your details are still there. ${payHow}`) +
      btn(REG, "Complete My Registration") +
      p(`We go live on Zoom on ${zoom}. Questions? Write to ${contact}.`) + sign },
  { f: "06-unpaid-reminder-2", h: "Don't let your seat slip away.", name: "Unpaid — Reminder 2", subject: "Still want to join us? Reserve your seat", pre: "Your Build Your Breakthrough 2027 seat is waiting.",
    body: p(`Your Build Your Breakthrough 2027 seat is still waiting for you, but it isn't reserved until payment is completed.`) +
      ticketBox +
      p(`Return to your registration on the same phone or browser so your details are still saved. ${payHow}`) +
      btn(REG, "Complete My Registration") +
      p(`We meet live on Zoom on ${zoom}. Questions? Write to ${contact}.`) + sign },
  { f: "07-unpaid-tomorrow", h: "Tomorrow's the day. Save your seat.", name: "Unpaid — Tomorrow", subject: "Tomorrow: reserve your seat today", pre: "Build Your Breakthrough 2027 is tomorrow.",
    body: p(`Build Your Breakthrough 2027 is <strong style="${P}font-weight:600;">tomorrow</strong>, November 16, live on Zoom from 7:00 to 10:00 PM PHT.`) +
      p("Complete your payment today to reserve your seat.") +
      btn(REG, "Reserve My Seat") +
      p(`Questions? Write to ${contact}.`) + sign },
  { f: "08-unpaid-tonight", h: "Tonight's the night.", name: "Unpaid — Tonight", subject: "Tonight at 7:00 PM: last call", pre: "Complete your payment to join us live.",
    body: p(`Build Your Breakthrough 2027 is <strong style="${P}font-weight:600;">tonight at 7:00 PM PHT</strong>, live on Zoom until 10:00 PM.`) +
      p("If you'd like to join us, complete your payment now to reserve your seat.") +
      btn(REG, "Reserve My Seat") +
      p(`Questions? Write to ${contact}.`) + sign },
  { f: "09-payment-not-matched", h: "Let's get your payment sorted.", name: "Payment Couldn't Be Matched", subject: "We couldn't match your payment", pre: "Please resubmit your reference number and receipt.",
    body: p(`We couldn't match your payment for Registration ID <strong style="${P}font-weight:600;">${ID}</strong> (₱{{contact.fw27_amount}}).`) +
      p("Please check the reference number and screenshot, then resubmit them on the registration page using the same phone or browser you used before. You can also reply to this email with your Registration ID and we'll take a look.") +
      btn(REG, "Resubmit My Payment") +
      p(`Please don't send another payment until we reply. Thank you for your patience.`) + sign },
];

for (const e of emails) fs.writeFileSync(path.join(DIR, `13-bbyb-${e.f}.html`), page("Build Your Breakthrough 2027", e.h, e.body));

const idx = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Build Your Breakthrough 2027 emails</title>
<style>body{margin:0;background:#FAF8F4;font:16px/1.5 Inter,Arial,sans-serif;color:#1A1A1A}main{max-width:1200px;margin:0 auto;padding:32px 24px}h1{font:600 28px Poppins,Arial,sans-serif;margin:0 0 24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:28px}h2{font:600 16px Poppins,Arial,sans-serif;margin:0 0 4px}p{margin:0 0 10px;font-size:14px}iframe{width:100%;height:900px;border:1px solid #D9D3C7;border-radius:12px;background:#fff}</style></head><body><main><h1>Build Your Breakthrough 2027 — email set</h1><div class="g">
${emails.map((e) => `<section><h2>${e.f.slice(0, 2)} · ${e.name}</h2><p><b>Subject:</b> ${e.subject}<br><b>Preview:</b> ${e.pre}</p><iframe src="13-bbyb-${e.f}.html" loading="lazy"></iframe></section>`).join("\n")}
</div></main></body></html>`;
fs.writeFileSync(path.join(DIR, "13-bbyb-preview.html"), idx);
console.log(emails.map((e) => `${e.f}\n   subject: ${e.subject}\n   preview: ${e.pre}`).join("\n"));
