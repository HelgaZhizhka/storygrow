-- Create a separate database for LangFuse so it doesn't collide with the
-- application schema. The pgvector extension stays on the storygrow DB only.
CREATE DATABASE langfuse;
