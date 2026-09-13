# How Codex Lite works

The desktop app is the workspace. Ollama is the local model runner. The Go backend is the account service. PostgreSQL remembers account and subscription data.

## Asking a question

The app sends text to Qwen Coder on your Mac. For ordinary image-containing chat, it chooses Qwen3-VL instead. Your chats and editable memory are stored locally.

When you ask for internet search, the app retrieves search snippets and asks the local model to answer from them. Searching and answering are separate steps. A successful lookup can still lead to a poor model answer, so the app checks for a sourced final response and retries once. It cannot guarantee correctness.

## Opening code

A folder gets a workspace tab. Selecting a file in the right-side tree replaces the file shown inside that tab. Breadcrumbs show where it lives. Edits autosave with revision checks so an external edit does not silently get overwritten.

Generated code has no path yet, so Save as file asks you where it belongs.

## Signing in

```text
App -> Go server -> GitHub authorization in browser
                       |
                       v
App <- account session <- Go callback
```

The server holds the OAuth client secret. The desktop app does not.

## Trying the subscription demo

```text
App -> hosted checkout -> Stripe sandbox
                            |
                       signed webhook
                            |
App <- refreshed access <- Go + PostgreSQL
```

A successful redirect alone does not prove that access has been activated. The server receives and verifies the Stripe event and updates account state.

The public demo uses test cards, not real money. Do not switch to live keys to demonstrate the resume project.

## What the cloud is for

Render runs the Go account service. Supabase hosts its PostgreSQL database. They do not run the local Qwen models. The retained cloud-AI API is an optional older path, not the default desktop inference flow.

See [architecture](ARCHITECTURE.md) for details and [setup](SETUP.md) to run it.
