# Discord SumUpVidz

Bot Discord qui detecte automatiquement les liens YouTube et les liens web postes dans un salon, et repond avec un resume en points cles genere par l'API Gemini.

## Prerequis

- Un compte Discord et les droits pour creer une application/bot sur le serveur cible.
- Une cle API Gemini (gratuite) : https://aistudio.google.com/apikey
- Une VM Debian avec Docker + Portainer (pour le deploiement en production).

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
git remote add origin https://github.com/<votre-utilisateur>/discord-sumupvidz.git
git push -u origin main
```

Le `.gitignore` exclut deja `node_modules/` et `.env` : votre token et votre cle API ne seront jamais commit.

## 5. Deployer sur votre VM Debian via Portainer

Cette methode fait construire l'image Docker par Portainer directement depuis votre depot GitHub, ce qui permet de redeployer facilement en cas de mise a jour du code.

1. Ouvrir l'interface web de Portainer, puis dans le menu de gauche : **Stacks** > **Add stack**.
2. **Name** : `discord-sumupvidz` (ou ce que vous voulez).
3. **Build method** : choisir **Repository**.
4. Renseigner :
   - **Repository URL** : `https://github.com/<votre-utilisateur>/discord-sumupvidz`
   - **Repository reference** : `refs/heads/main`
   - **Compose path** : `docker-compose.yml`
   - Si le repo est prive, activer **Authentication** et fournir un [Personal Access Token GitHub](https://github.com/settings/tokens) (scope `repo` en lecture suffit).
5. Descendre jusqu'a **Environment variables** et ajouter :
   | Name | Value |
   |---|---|
   | `DISCORD_TOKEN` | le token recupere a l'etape 1 |
   | `GEMINI_API_KEY` | la cle recuperee a l'etape 2 |
6. Cliquer sur **Deploy the stack**. Portainer clone le repo, build l'image via le `Dockerfile`, et demarre le conteneur. Un volume Docker nomme (`sumupvidz-data`) est cree automatiquement pour stocker la configuration des salons : il persiste entre deux redeploiements.
7. Verifier que ca tourne : dans **Containers**, ouvrir `discord-sumupvidz` puis l'onglet **Logs** — vous devez voir `Connecte en tant que ...`.

### Mettre a jour le bot apres un changement de code

Dans Portainer, ouvrir la stack `discord-sumupvidz` et cliquer sur **Pull and redeploy** (ou **Update the stack**) : Portainer re-clone la derniere version du repo et reconstruit l'image.

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DISCORD_TOKEN` | oui | Token du bot, depuis le Discord Developer Portal. |
| `GEMINI_API_KEY` | oui | Cle API Gemini, depuis Google AI Studio. |

## Restreindre le bot a un salon

Par defaut, le bot repond dans tous les salons ou il a acces. Un membre avec la permission **Gerer le serveur** peut le restreindre a un seul salon avec la commande :

```
/sumup channel [salon]
```

- Sans argument : restreint au salon ou la commande est tapee.
- Avec un salon en argument : restreint a ce salon precis.

Ce reglage est stocke par serveur dans le volume `sumupvidz-data` et survit aux redeploiements.

## Limites connues

- Seules les videos YouTube **publiques** peuvent etre resumees (pas les videos privees/non repertoriees).
- Tier gratuit Gemini : 8h de video YouTube traitee par jour, ~1500 requetes/jour sur `gemini-flash-latest`. Suffisant pour un usage normal de salon Discord.
- La fonctionnalite "URL YouTube directe" de l'API Gemini est en preview chez Google : le comportement ou les quotas peuvent evoluer.
