-- AddUniqueConstraint: Child(userId, name) — prevent duplicate child names per user
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_name_key" UNIQUE ("userId", "name");
