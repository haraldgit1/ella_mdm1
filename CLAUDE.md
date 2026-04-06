@AGENTS.md


Projekt init:
mit folgenden Befehl wird das Next.js Projekt initialisiert:
npx create-next-app@latest

Als erste Anpassung wird mit claude die Standard-StartSeite 
von next.js geändert:
Replace the starting page of the Next.js project in ella_mdm with a page that say "hello Ella MDM" in the middle of the screen   


Github einrichten:
auf Github habe ich über "New repository" das Repository ella_mdm1 eingerichtet.

lokal habe dann folgendes ausgeführt:
echo "# ella_mdm1" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/haraldgit1/ella_mdm1.git
git push -u origin main
