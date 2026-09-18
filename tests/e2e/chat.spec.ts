import { expect, test } from "@playwright/test";

test("ouvre le chat et diffuse une réponse", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bonjour Arthur/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Message" }).fill("Aide-moi à diagnostiquer une erreur dans mon projet React");
  const streamedResponse = page.waitForResponse((response) => response.url().endsWith("/api/chat") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  expect((await streamedResponse).ok()).toBe(true);
  await expect(page.locator("article.message.assistant .message-body > p")).not.toBeEmpty();
});

test("les pages produit principales sont accessibles", async ({ page }) => {
  await page.goto("/skills");
  await expect(page.getByRole("heading", { name: /expert pour chaque mission/ })).toBeVisible();
  await page.goto("/files");
  await expect(page.getByRole("heading", { name: /fichiers en contexte/ })).toBeVisible();
  await page.goto("/usage");
  await expect(page.getByRole("heading", { name: /utilisation claire/ })).toBeVisible();
});
