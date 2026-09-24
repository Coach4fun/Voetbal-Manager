/* =========================================================
   Supabase-configuratie voor VoetbalTeam Manager
   =========================================================
   Vul hieronder je eigen Project URL en anon/public key in.
   Je vindt beide in het Supabase-dashboard onder:
   Project Settings > API > Project URL / anon public.

   Deze anon key is BEDOELD om publiek in de browser te staan
   (dat is hoe Supabase werkt) - de daadwerkelijke beveiliging
   wordt geregeld via Row Level Security (RLS) policies in de
   database. Voer eerst supabase/schema.sql uit in de Supabase
   SQL Editor voordat je dit bestand invult, anders werkt de
   RLS-beveiliging niet.

   Zolang hieronder nog de voorbeeldwaarden staan ("YOUR-..."),
   negeert de app deze configuratie volledig en werkt de app
   gewoon lokaal (zoals voorheen), zonder inlogscherm.
   ========================================================= */

window.VTM_SUPABASE_CONFIG = {
  url: "https://bxjrlqkvyxiyahjrjnwb.supabase.co",
  anonKey: "sb_publishable_c6BCWyvIZiEfPtSxoq_yAA_-kw-NEU0"
};
