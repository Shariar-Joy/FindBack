import { test, expect, type Page } from '@playwright/test'
const password = process.env.DEMO_PASSWORD
const backend = process.env.E2E_API_URL || 'http://127.0.0.1:8000'
const unique = Date.now()
const reporter = `e2e.reporter.${unique}@example.com`
const subscriber = `e2e.subscriber.${unique}@example.com`
async function signIn(page: Page, email: string, pass: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByPlaceholder('Enter your password').fill(pass)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/dashboard/)
}
async function register(page: Page, email: string, name: string) {
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email address').fill(email)
  await page.getByPlaceholder('Enter your password').fill('TestingPassword123')
  await page.getByLabel('Confirm password').fill('TestingPassword123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('All set', { exact: true })).toBeVisible()
  await signIn(page, email, 'TestingPassword123')
}
test('register → private report → moderation → public case → private sighting → email → resolution', async ({
  browser,
}) => {
  test.skip(!password, 'Set DEMO_PASSWORD to the password used by the development seed.')
  const reporterContext = await browser.newContext()
  const reporterPage = await reporterContext.newPage()
  await register(reporterPage, reporter, 'Fictional E2E Reporter')
  for (const width of [320, 768]) {
    await reporterPage.setViewportSize({ width, height: 900 })
    for (const route of ['/dashboard', '/report-missing']) {
      await reporterPage.goto(route)
      await expect(reporterPage.getByRole('heading', { level: 1 })).toBeVisible()
      expect(
        await reporterPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy()
    }
  }
  await reporterPage.setViewportSize({ width: 1280, height: 900 })
  const subscriberContext = await browser.newContext()
  const subscriberPage = await subscriberContext.newPage()
  await register(subscriberPage, subscriber, 'Fictional E2E Subscriber')
  await subscriberPage.goto('/dashboard?tab=subscriptions')
  await subscriberPage.getByLabel('District to subscribe').selectOption('BD:Dhaka')
  await subscriberPage.getByRole('button', { name: 'Subscribe', exact: true }).click()
  await expect(subscriberPage.getByRole('button', { name: 'Unsubscribe from Dhaka' })).toBeVisible()
  await reporterPage.goto('/report-missing')
  await reporterPage.getByLabel('Person’s full name').fill(`Fictional E2E ${unique}`)
  await reporterPage.getByLabel('Approximate age').fill('29')
  await reporterPage
    .getByLabel('Physical description')
    .fill('Synthetic test record. A fictional person with short dark hair.')
  await reporterPage
    .getByLabel('Clothing when last seen')
    .fill('Fictional blue shirt and grey trousers')
  await reporterPage.getByRole('button', { name: 'Continue' }).click()
  await reporterPage.getByLabel('Last-seen date').fill('2026-01-12T10:00')
  await reporterPage.getByLabel('Division', { exact: true }).selectOption('Dhaka')
  await reporterPage.getByLabel('District', { exact: true }).selectOption('Dhaka')
  await reporterPage.getByLabel('City / Upazila').fill('Dhaka')
  await reporterPage.getByLabel('General area').fill('Fictional general district area')
  await reporterPage.getByRole('button', { name: 'Continue' }).click()
  await reporterPage.getByLabel('Your relationship').fill('Fictional sibling')
  await reporterPage.getByLabel('Private email address').fill(reporter)
  await reporterPage.getByRole('checkbox').check()
  await reporterPage.getByRole('button', { name: 'Continue' }).click()
  for (const checkbox of await reporterPage.getByRole('checkbox').all()) await checkbox.check()
  await reporterPage.getByRole('button', { name: 'Submit private report' }).click()
  await expect(reporterPage.getByText('Your case reference', { exact: true })).toBeVisible()
  const code = (await reporterPage.locator('.reference-box strong').innerText()).trim()
  const publicContext = await browser.newContext()
  expect((await publicContext.request.get(`${backend}/api/v1/cases/${code}`)).status()).toBe(404)
  const modContext = await browser.newContext()
  const mod = await modContext.newPage()
  await signIn(mod, 'moderator@example.com', password!)
  await mod.goto(`/moderator/cases/${code}`)
  await mod.setViewportSize({ width: 390, height: 900 })
  expect(
    await mod.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await mod.getByLabel(/Publish approximate Dhaka/).check()
  await mod.getByLabel(/I have reviewed every public field/).check()
  await mod.getByRole('button', { name: 'Save decision' }).click()
  await expect(mod.getByRole('button', { name: /Resolve & remove/ })).toBeVisible()
  const publicPage = await publicContext.newPage()
  await publicPage.goto(`/cases/${code}`)
  await expect(publicPage.getByRole('heading', { name: `Fictional E2E ${unique}` })).toBeVisible()
  expect(await publicPage.locator('body').innerText()).not.toContain(reporter)
  await subscriberPage.goto(`/cases/${code}/sighting`)
  await subscriberPage.getByLabel('Approximate date & time').fill('2026-01-13T11:00')
  await subscriberPage
    .getByLabel('Approximate sighting location')
    .fill('Fictional district area for private review')
  await subscriberPage
    .getByLabel('What did you observe')
    .fill('A synthetic observation to exercise the private sighting workflow.')
  await subscriberPage.getByRole('checkbox').check()
  await subscriberPage.getByRole('button', { name: 'Submit private sighting' }).click()
  await expect(
    subscriberPage.getByRole('heading', { name: 'Your observation could make a difference.' }),
  ).toBeVisible()
  await mod.goto('/moderator?tab=sightings')
  const sighting = mod.locator('form').filter({ hasText: code })
  await sighting.getByLabel('Private review notes').fill('Synthetic observation reviewed in E2E')
  await sighting.getByRole('button', { name: 'Save review' }).click()
  await expect(sighting.locator('.badge')).toHaveText('reviewed')
  await expect
    .poll(
      async () => {
        const r = await subscriberContext.request.get(`${backend}/api/v1/me/notifications`)
        return (await r.json()).items.find(
          (n: { case_code: string; status: string }) => n.case_code === code,
        )?.status
      },
      { timeout: 20000 },
    )
    .toBe('SENT')
  const mail = await publicContext.request.get('http://127.0.0.1:8025/api/v1/messages')
  expect(
    (await mail.json()).messages.some(
      (m: { To: { Address: string }[]; Subject: string }) =>
        m.To.some((to) => to.Address === subscriber) && m.Subject.includes('Dhaka'),
    ),
  ).toBeTruthy()
  await mod.goto(`/moderator/cases/${code}`)
  await mod
    .getByLabel('Reason for action')
    .fill('Synthetic workflow: person confirmed found safely')
  await mod.getByRole('button', { name: /Resolve & remove/ }).click()
  await expect(mod.locator('.badge').first()).toHaveText('resolved')
  expect((await publicContext.request.get(`${backend}/api/v1/cases/${code}`)).status()).toBe(404)
  for (const context of [reporterContext, subscriberContext, publicContext, modContext])
    await context.close()
})
test('desktop, mobile, directory, map and public pages render without runtime errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Helping missing people/ })).toBeVisible()
  await expect(page.getByText('Ayan Example', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/findback-desktop.png', fullPage: true })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Helping missing people/ })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy()
    if (width === 390)
      await page.screenshot({ path: 'test-results/findback-mobile.png', fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/cases')
  await expect(
    page.getByRole('heading', { name: 'Every connection could bring someone home.' }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Search name or case reference' }).fill('Ayan')
  await expect(page.locator('.case-card')).toHaveCount(1)
  await page.goto('/map')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.locator('.case-map-pin').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/findback-map.png', fullPage: true })
  for (const path of [
    '/alerts',
    '/about',
    '/privacy',
    '/terms',
    '/safety',
    '/contact',
    '/forgot-password',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('administrator analytics and operational screens use real records', async ({ page }) => {
  test.skip(!password, 'Use the isolated harness to supply generated test credentials.')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await signIn(page, 'admin@example.com', password!)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible()
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'User management', exact: true }).click()
  await expect(page.getByText('admin@example.com', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Audit log', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  await page.getByRole('button', { name: 'Notification jobs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Durable notification outbox' })).toBeVisible()
  await page.getByRole('button', { name: 'System health', exact: true }).click()
  await expect(page.getByRole('definition').filter({ hasText: 'connected' })).toBeVisible()
  expect(errors).toEqual([])
})
