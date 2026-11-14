import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FILE_BYTES,
  deliverableStoragePath,
  formatFileSize,
  isPreviewableImage,
  parseCommentForm,
  validateDeliverableFile,
} from "../src/lib/deliverableFiles.mjs";
import { buildNotification, emailForNotification, relativeTime } from "../src/lib/notificationRules.mjs";

test("accepts a normal upload and derives the content type from the extension", () => {
  const { values, error } = validateDeliverableFile({ name: "Diwali  Reel final.MP4", size: 1024 * 1024 });
  assert.equal(error, undefined);
  assert.equal(values.fileName, "Diwali Reel final.MP4");
  assert.equal(values.extension, "mp4");
  assert.equal(values.contentType, "video/mp4");
  assert.equal(values.sizeBytes, 1024 * 1024);
});

test("strips paths and unsafe characters from file names", () => {
  const { values } = validateDeliverableFile({ name: "C:\\Users\\me\\..\\a<b>:c|d?.pdf", size: 10 });
  assert.equal(values.fileName, "abcd.pdf");
  assert.equal(values.contentType, "application/pdf");
});

test("rejects unsupported, oversized, and empty files", () => {
  assert.match(validateDeliverableFile({ name: "virus.exe", size: 100 }).error, /not supported/);
  assert.match(validateDeliverableFile({ name: "no-extension", size: 100 }).error, /not supported/);
  assert.match(validateDeliverableFile({ name: "big.png", size: MAX_FILE_BYTES + 1 }).error, /25 MB or smaller/);
  assert.match(validateDeliverableFile({ name: "empty.png", size: 0 }).error, /empty/);
  assert.match(validateDeliverableFile({ name: "", size: 10 }).error, /Choose a file/);
});

test("storage paths and helpers", () => {
  assert.equal(deliverableStoragePath("deliv-1", "file-2", "png"), "deliv-1/file-2.png");
  assert.equal(formatFileSize(512), "1 KB");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(26214400), "25 MB");
  assert.equal(formatFileSize(1572864), "1.5 MB");
  assert.ok(isPreviewableImage("image/png"));
  assert.ok(!isPreviewableImage("application/pdf"));
});

test("comments are trimmed and bounded", () => {
  const data = new FormData();
  data.set("body", "  Looks great!\r\nShip it  ");
  assert.equal(parseCommentForm(data).values.body, "Looks great!\nShip it");

  data.set("body", "   ");
  assert.match(parseCommentForm(data).error, /Write a comment/);
  data.set("body", "x".repeat(2001));
  assert.match(parseCommentForm(data).error, /2,000/);
});

test("notification builders produce titles, bodies, and safe hrefs", () => {
  const ready = buildNotification("deliverable_ready", { deliverableTitle: "Diwali reel" });
  assert.equal(ready.title, "“Diwali reel” is ready for your review");
  assert.equal(ready.href, "/client/portal#deliverables");

  const approved = buildNotification("review_approved", { clientName: "Acme", deliverableTitle: "Reel", note: "Nice" });
  assert.match(approved.title, /Acme approved/);
  assert.match(approved.body, /Nice/);

  const sent = buildNotification("invoice_sent", { invoiceId: "abc", invoiceNumber: "INV-2026-0001", amount: 25000, dueDate: "2026-11-29" });
  assert.match(sent.title, /INV-2026-0001/);
  assert.equal(sent.href, "/invoices/abc");
  assert.ok(sent.title.length <= 160);

  const comment = buildNotification("comment_added", {
    deliverableTitle: "x".repeat(300),
    authorName: "Raju",
    comment: "y".repeat(500),
    forStaff: true,
  });
  assert.ok(comment.title.length <= 160);
  assert.ok(comment.body.length <= 400);
  assert.equal(comment.href, "/admin/dashboard#clients");

  assert.throws(() => buildNotification("nonsense", {}), /Unknown notification event/);
});

test("notification emails carry the agency name and an absolute link", () => {
  const { subject, text } = emailForNotification(
    { title: "Invoice INV-1", body: "Due soon.", href: "/invoices/abc" },
    { agencyName: "Moonkalp Studio", siteUrl: "https://moonkalp-crm.vercel.app" },
  );
  assert.equal(subject, "Moonkalp Studio: Invoice INV-1");
  assert.match(text, /https:\/\/moonkalp-crm\.vercel\.app\/invoices\/abc/);
  assert.match(text, /— Moonkalp Studio/);

  const noSite = emailForNotification({ title: "T", body: null, href: "/x" }, { agencyName: "A", siteUrl: undefined });
  assert.ok(!noSite.text.includes("undefined"));
});

test("relative times read naturally", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  assert.equal(relativeTime("2026-11-14T11:59:40Z", now), "just now");
  assert.equal(relativeTime("2026-11-14T11:10:00Z", now), "50m ago");
  assert.equal(relativeTime("2026-11-14T06:00:00Z", now), "6h ago");
  assert.equal(relativeTime("2026-11-11T12:00:00Z", now), "3d ago");
  assert.match(relativeTime("2026-10-01T12:00:00Z", now), /Oct/);
});
