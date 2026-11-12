env "outpost" {
  url = getenv("OUTPOST_DATABASE_URL")

  migration {
    dir = "file://neon/migrations"
  }
}
