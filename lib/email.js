export function buildDigestEmail(orgName, weekOf, totalIdeas, insights) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">

  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
    <div style="width: 18px; height: 18px; background: #F7FE4F; border-radius: 50%;"></div>
    <strong style="font-size: 16px;">Coelacanth</strong>
    <span style="color: #888; font-size: 13px; margin-left: auto;">Week of ${weekOf}</span>
  </div>

  <h1 style="font-size: 20px; margin: 0 0 4px;">${orgName} — Weekly Insights</h1>
  <p style="color: #666; font-size: 14px; margin: 0 0 24px;">${totalIdeas} anonymous submissions this week</p>

  <!-- Top issues -->
  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 12px;">Top issues</h2>
  ${insights.top_issues.map(issue => `
    <div style="padding: 12px; background: #f9f9f9; border-radius: 8px; margin-bottom: 8px;">
      <strong style="font-size: 15px;">${issue.theme}</strong>
      <span style="color: #666; font-size: 13px; margin-left: 8px;">${issue.count} mentions</span>
      <p style="color: #555; font-size: 13px; margin: 4px 0 0; font-style: italic;">"${issue.example}"</p>
    </div>
  `).join('')}

  <!-- Quick wins -->
  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 24px 0 12px;">Quick wins this week</h2>
  ${insights.quick_wins.map(win => `
    <div style="padding: 8px 12px; border-left: 3px solid #F7FE4F; margin-bottom: 6px; font-size: 14px;">${win}</div>
  `).join('')}

  <!-- AI insight -->
  <div style="background: #fffff0; border: 1px solid #e8ef00; border-radius: 8px; padding: 14px; margin: 24px 0;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888;">AI insight</strong>
    <p style="margin: 6px 0 0; font-size: 14px; font-style: italic;">${insights.ai_insight}</p>
  </div>

  <p style="color: #aaa; font-size: 12px; margin-top: 32px; text-align: center;">
    Powered by Coelacanth · <a href="{{dashboard_url}}" style="color: #888;">View full dashboard</a>
  </p>

</body>
</html>`
}
