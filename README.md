# Discord SumUpVidz

Bot Discord qui detecte automatiquement les liens YouTube et les liens web postes dans un salon, et repond avec un resume en points cles (en anglais) genere par l'API Gemini.

Toutes les reponses et commandes du bot sont en anglais.

## Prerequis

- Un compte Discord et les droits pour creer une application/bot sur le serveur cible.
- Une cle API Gemini (gratuite) : https://aistudio.google.com/apikey
- Un hote Docker avec Portainer pour la production (actuellement : Unraid x86_64 ; l'image tourne aussi sur arm64).

## 1. Creer le bot Discord

1. Aller sur le [Discord Developer Portal](https://discord.com/developers/applications) et cliquer sur **New Application**. Lui donner un nom (ex: `SumUpVidz`).
2. Dans le menu de gauche, aller dans **Bot**.
   - Cliquer sur **Reset Token** pour generer le token, et le copier (vous ne pourrez plus le revoir apres avoir quitte la page).
   - Descendre jusqu'a **Privileged Gateway Intents** et activer **MESSAGE CONTENT INTENT** (indispensable : sans ca, le bot ne peut pas lire le contenu des messages, donc ne peut pas detecter les liens).
3. Aller dans **OAuth2 > URL Generator** :
   - Dans **Scopes**, cocher `bot` **et** `applications.commands` (indispensable pour que la commande `/sumup` fonctionne).
   - Dans **Bot Permissions**, cocher au minimum : `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`.
   - Copier l'URL generee en bas de page, l'ouvrir dans un navigateur, et inviter le bot sur votre serveur.

Si le bot est deja invite sans le scope `applications.commands`, regenerez l'URL avec les deux scopes coches et re-autorisez-la sur le meme serveur : ca ajoute le scope manquant sans avoir a re-inviter le bot depuis zero.

Gardez le **token** de coté, il vous servira de valeur pour `DISCORD_TOKEN`.

## 2. Recuperer la cle API Gemini

1. Aller sur https://aistudio.google.com/apikey
2. **Create API key** > **Create API key in new project**.
3. Copier la cle, elle servira de valeur pour `GEMINI_API_KEY`.

## 3. Tester en local (optionnel mais recommande avant de deployer)

```bash
npm install
cp .env.example .env
# renseigner DISCORD_TOKEN et GEMINI_API_KEY dans .env
npm start
```

Postez un lien YouTube ou un lien vers un article dans un salon ou le bot a acces : il doit repondre avec un resume en quelques secondes.

## 4. Publier le projet sur GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<votre-utilisateur>/SumUpVidz-bot.git
git push -u origin main
```

Le `.gitignore` exclut deja `node_modules/` et `.env` : votre token et votre cle API ne seront jamais commit.

## 5. Deployer sur Unraid via Portainer

Portainer construit l'image directement depuis le depot GitHub. Le bot tourne en utilisateur non-root `node` (UID/GID 1000) et ses donnees (configuration des salons) sont dans un dossier de l'hote.

1. Sur l'hote Unraid, creer le dossier de donnees et le donner a l'UID 1000 :
   ```bash
   mkdir -p /mnt/user/appdata/sumupvidz-bot/data
   chown -R 1000:1000 /mnt/user/appdata/sumupvidz-bot
   ```
2. Dans Portainer : declarer le depot comme **Git source** si besoin, puis **Stacks** > **Add stack** :
   - **Name** : `sumupvidz-bot`
   - **Build method** : **Repository**, reference `refs/heads/main`, compose path `docker-compose.yml`
   - **GitOps updates** : desactive (on redeploie a la main).
3. **Environment variables** :
   | Name | Value |
   |---|---|
   | `DISCORD_TOKEN` | le token recupere a l'etape 1 |
   | `GEMINI_API_KEY` | la cle recuperee a l'etape 2 |
   | `SUMUPVIDZ_DATA_PATH` | `/mnt/user/appdata/sumupvidz-bot/data` |
   | `BOT_REPLICAS` | `1` (ou `0` pour deployer sans connecter le bot) |
4. **Deploy the stack**, puis verifier dans **Containers** > `sumupvidz-bot` > **Logs** : `Logged in as ...`.

L'icone affichee dans l'onglet Docker d'Unraid vient du label `net.unraid.docker.icon` du `docker-compose.yml` (`icons/SumUpVidz-256.png`, servi par jsDelivr).

> **Un seul bot par token.** Ne jamais faire tourner deux instances avec le meme `DISCORD_TOKEN` (ex : ancienne et nouvelle machine pendant une migration). Mettre `BOT_REPLICAS=0` sur l'instance qui doit rester eteinte.

Sans `SUMUPVIDZ_DATA_PATH`, le compose utilise un volume Docker nomme `sumupvidz-data` (pratique en local ou sur un autre hote). Si ce volume a ete cree par une ancienne image qui tournait en root, faire un `chown -R 1000:1000` sur son contenu.

### Mettre a jour le bot apres un changement de code

Dans Portainer, ouvrir la stack `sumupvidz-bot` et cliquer sur **Pull and redeploy** (avec **Re-pull image and redeploy**) : Portainer re-clone la derniere version du depot et reconstruit l'image. Les dependances sont figees par `package-lock.json` (`npm ci`).

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DISCORD_TOKEN` | oui | Token du bot, depuis le Discord Developer Portal. |
| `GEMINI_API_KEY` | oui | Cle API Gemini, depuis Google AI Studio. |
| `SUMUPVIDZ_DATA_PATH` | non | Chemin hote des donnees (defaut : volume nomme `sumupvidz-data`). Doit appartenir a l'UID 1000. |
| `BOT_REPLICAS` | non | `1` (defaut) pour lancer le bot, `0` pour garder la stack sans connexion a Discord. |

## Fonctionnement

- Le bot affiche « is typing... » pendant toute la generation du resume.
- Si Gemini est surcharge ou indisponible (HTTP 429/500/503/504 ou erreur reseau), le bot retente jusqu'a 3 fois (attente de 15 s puis 30 s) et l'indique dans un message de statut :
  - `⏳ Gemini is overloaded, 2nd try in 15s (attempt 2/3)...`
  - `⏳ Gemini is overloaded, 3rd try in 30s (attempt 3/3)...`
  - apres 3 echecs : `❌ Gemini is still overloaded after 3 tries. Please try again later.`
- Ce message de statut est supprime si le resume finit par arriver.
- Les erreurs definitives (video privee, page illisible...) ne sont pas retentees : `❌ Sorry, I couldn't summarize <url>.`
- Les delais de retry se reglent dans `RETRY_DELAYS_MS` (`src/gemini.js`).

## Restreindre le bot a un salon

Par defaut, le bot repond dans tous les salons ou il a acces. Un membre avec la permission **Gerer le serveur** peut le restreindre a un seul salon avec la commande :

```
/sumup channel [channel]
```

- Sans argument : restreint au salon ou la commande est tapee.
- Avec l'option `channel` : restreint a ce salon precis.

Ce reglage est stocke par serveur dans `data/config.json` (dossier `SUMUPVIDZ_DATA_PATH` ou volume `sumupvidz-data`) et survit aux redeploiements.

## Limites connues

- Seules les videos YouTube **publiques** peuvent etre resumees (pas les videos privees/non repertoriees).
- Tier gratuit Gemini : 8h de video YouTube traitee par jour, ~1500 requetes/jour sur `gemini-flash-latest`. Suffisant pour un usage normal de salon Discord.
- La fonctionnalite "URL YouTube directe" de l'API Gemini est en preview chez Google : le comportement ou les quotas peuvent evoluer.
