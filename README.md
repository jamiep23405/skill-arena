1 .Open Netlify and connect the repository 
– Log in to your Netlify account.
– Click on “Add new site” → “Import from Git.” 
– Select GitHub as the source and authorize access.
– Select the game repository.

2. Check build settings
   
– Netlify usually recognizes the settings automatically.
– If necessary, please enter the build command and output directory (e.g., npm run build and dist/ or build/).

3. Set environment variables
– If Supabase keys are required, enter them in Netlify under “Site Settings → Build & Deploy → Environment.”
– For example: SUPABASE_URL and SUPABASE_ANON_KEY.

5. Check Supabase
   
– Log in to Supabase and make sure that the correct project is displayed.

7. Start deployment
   
– Click “Deploy Site” in Netlify. – Netlify will publish the project automatically.
– The game will then be accessible directly via the generated Netlify URL.

As soon as you send me your details, I will invite you directly to all three platforms and you can get started right away.

If you want a custom domain:
8. Purchase your own domain (if you don't already have one)

– If you don't already have your own domain, you can purchase one from a provider such as United Domains.
– Visit united-domains.de and search for your desired domain name.
– Select an available domain and complete the purchase.
– After purchasing, you will find the DNS settings for your domain in the customer area.
– You will need this DNS data later to connect the domain to Netlify.

9. Connect your own domain and activate SSL
    
– In Netlify, go to “Site Settings” → “Domain Management.”
– Click on “Add Custom Domain” and enter your domain.
– Netlify will show you the required DNS entries.
– Log in to your domain provider and enter these DNS entries (A or CNAME entries).
– Once the connection is established, Netlify will automatically activate a free SSL certificate (Let's Encrypt).
– If not, you can activate it manually under “Domain Management → HTTPS.”
