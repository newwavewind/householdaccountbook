-- CreateTable
CREATE TABLE "household_ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payload" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author_id" TEXT NOT NULL,
    "author_display_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");
