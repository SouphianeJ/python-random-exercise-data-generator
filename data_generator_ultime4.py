import pandas as pd
from faker import Faker
import random
from datetime import datetime, timedelta, time
import numpy as np
from scipy.stats import skewnorm
from decimal import Decimal, ROUND_HALF_UP

# Configuration réaliste
fake = Faker('fr_FR')
random.seed(32)
np.random.seed(44)

# Paramètres de génération
num_stores = 5
num_products = 100
N_EMPLOYES = 200
num_customers = 3000
N_VENTES = 250000



# 1. MAGASINS (Stores)
# Génère des magasins avec une répartition réaliste par zone géographique (centre-ville/périphérie),
# une spécialisation sur certaines marques, une estimation de flux clients et du chiffre d’affaires mensuel.
# Ajuste le nombre d’employés en fonction de la taille et du positionnement du magasin.
# Implémente des variations saisonnières et des jours de forte affluence.

def generate_stores():
    # Définition des marques possibles et des types de magasin
    brands = ["Nike", "Adidas", "Puma", "Reebok", "Asics", "New Balance", "Jordans"]
    store_types = ["Premium", "Discount", "Standard"]  # Types de magasins
    
    stores = []
     
    
    for i in range(1, num_stores+1):
        # Zone géographique : centre-ville vs périphérie
        zone = "Centre-ville" if random.random() < 0.6 else "Périphérie"
        
        surface0 = 90 # 70m carré par défaut
        hyper = "non"
        # Type de magasin en fonction de la zone (centre-ville favorise Premium, périphérie favorise Discount/Standard)
        if zone == "Centre-ville":
            
            store_type = random.choices(["Premium", "Standard", "Discount"], weights=[0.3, 0.6, 0.1])[0]
            #jours d'ouvertures


            #Gérer la surface des magasins en ville
            if store_type == "Premium": 
                surface = round(surface0 * random.uniform(0.5 , 0.7)) #plus intimiste si shop premium
            elif store_type == "Standard":
                surface = round(surface0 * random.uniform(0.9 , 1.2)) #standard
            else:
                surface = round(surface0 * random.uniform(1.2 , 1.5)) #plus grand si discount
            open_days = random.choices(["open 5/7", "open 6/7"], weights=[0.7, 0.3])[0]
            open_to_clients_hours = random.choices(["9h/18h", "9h/19h", "9h/20h"], weights=[0.5, 0.3, 0.2])[0]
            
        else:
                      
            store_type = random.choices(["Discount", "Standard"], weights=[0.5, 0.5])[0]
            
            if store_type == "Standard":
                surface = round(surface0 * random.uniform(1.1, 2)) #standard
            else:
                surface = round(surface0 * random.uniform(1.5 , 3.5)) #plus grand si discount
                
            open_days = random.choices(["open 5/7", "open 6/7"], weights=[0.9, 0.1])[0]
            open_to_clients_hours = random.choices(["9h/18h", "9h/19h", "9h/20h"], weights=[0.1, 0.6, 0.3])[0]

        if open_to_clients_hours == "9h/18h": 
            open_time = 9
        elif open_to_clients_hours == "9h/19h":
            open_time = 10
        else:
            open_time = 11
            
        
        # Spécialisation : sélection de marques phares pour ce magasin
        if store_type == "Premium":
            # Un magasin Premium se focalise sur une seule grande marque (flagship)
            specialty_brands = [random.choice(brands)]
        elif store_type == "Discount":
            # Un magasin Discount propose un assortiment large (3 à 5 marques) avec des fins de série
            specialty_brands = random.sample(brands, k=min(len(brands), random.randint(3, 5)))
        else:  # Standard
            # Un magasin standard propose 2 à 4 marques variées
            specialty_brands = random.sample(brands, k=min(len(brands), random.randint(2, 4)))

        
        
        
        # Flux clients quotidien (foot traffic) selon le type de magasin et la zone
        if store_type == "Premium":
            
            foot_traffic_by_hour = random.randint(round(surface/8), round(surface/6)) if zone == "Centre-ville" else random.randint(round(surface/8), round(surface/6))
        elif store_type == "Discount":
            
            foot_traffic_by_hour = random.randint(round(surface/7), round(surface/5)) if zone == "Centre-ville" else random.randint(round(surface/6), round(surface/4))
        else:  # Standard
            
            foot_traffic_by_hour = random.randint(round(surface/7), round(surface/5)) if zone == "Centre-ville" else random.randint(round(surface/7), round(surface/5))


        if surface > (2.5*surface0): # si c'est un très grand magasin on augmente le traffic
            foot_traffic_by_hour += 8
            hyper = "oui"
        
        foot_traffic = foot_traffic_by_hour*open_time
        
        # Taux de conversion moyen (visiteurs qui réalisent un achat)
        if store_type == "Premium":
            conversion_rate = round(random.uniform(0.20, 0.28), 2)
        else:
            conversion_rate = round(random.uniform(0.14, 0.18), 2)
            
        #Calcul du nb de traffic converti en client    
        converted_foot_traffic_by_hour = round(foot_traffic_by_hour*conversion_rate)
        converted_foot_traffic = converted_foot_traffic_by_hour*open_time
        

        
        # Panier moyen (valeur moyenne d'une vente)
        if store_type == "Premium":
            avg_basket_value = random.randint(150, 300)
        elif store_type == "Discount":
            avg_basket_value = random.randint(80, 120)
        else:
            avg_basket_value = random.randint(100, 180)
        
        # Chiffre d'affaires mensuel estimé (approximation)
        monthly_revenue = int(foot_traffic * conversion_rate * avg_basket_value * 30)
        
        # Nombre d'employés (dépend de la taille/type du magasin)
        if store_type == "Premium":
            num_employees = round(0.04*surface)+3
        elif store_type == "Discount":
            num_employees = round(0.025*surface)+1
        else:
            num_employees = round(0.03*surface)+2
        
        # Création de l'enregistrement du magasin
        store = {
            "store_id": f"S{i:02d}",
            "zone": zone,
            "type": store_type,
            "surface": surface,
            "hyper": hyper,
            "specialty_brands": specialty_brands,
            "open_time" : open_time,
            "open_to_clients_hours" : open_to_clients_hours,
            "open_days" : open_days,
            "foot_traffic_by_hour" : foot_traffic_by_hour,
            "daily_foot_traffic": foot_traffic,
            "conversion_rate": conversion_rate,
            "traffic_conversion": converted_foot_traffic,
            "avg_basket_value": avg_basket_value,
            "monthly_revenue_est": monthly_revenue,
            "num_employees": num_employees
        }
        stores.append(store)
    return stores

# 2. EMPLOYÉS (Employees)
# Crée des profils de vendeurs (requin de la vente, expérimenté, jeune prometteur, débutant, blasé).
# Intègre des performances réalistes (ventes/jour, taux de conversion, panier moyen) pour chaque profil.
# Définit une grille salariale cohérente en fonction du profil.

def emp_profile(stores):
    # Définition des profils de vendeurs avec performances typiques et salaire mensuel (en euros)

    #hire_date
    requin_hire_date = fake.date_between(start_date='-12y', end_date='-6y')
    experimente_hire_date = fake.date_between(start_date='-15y', end_date='-8y')
    jeune_hire_date = fake.date_between(start_date='-6y', end_date='-3y')
    etudiant_hire_date = fake.date_between(start_date='-3y', end_date='-2y')
    blase_hire_date = fake.date_between(start_date='-25y', end_date='-15y')

    #salary month
    requin_salary = int(random.choices(["3200", "2800", "2900","3000","3100"])[0])
    experimente_salary = int(random.choices(["2500","2600","2700", "2800", "2900"])[0])
    jeune_salary = int(random.choices(["2000", "2100", "2200","2300","1900"])[0])
    etudiant_salary = int(random.choices(["700", "800", "900"])[0])
    blase_salary = int(random.choices(["2200","2300","2400","2500","2600"])[0])

    
    #time worked by month
    requin_time_worked = 145
    experimente_time_worked = 145
    jeune_time_worked = 145
    etudiant_time_worked = 70
    blase_time_worked = 145

    #roles
    role = ["Manager","Salesforce","Stagiaire"]

    #salary by hour
    requin_salary_by_hour = round(requin_salary/requin_time_worked,1)
    experimente_salary_by_hour = round(experimente_salary/experimente_time_worked,1)
    jeune_salary_by_hour = round(jeune_salary/jeune_time_worked,1)
    etudiant_salary_by_hour = round(etudiant_salary/etudiant_time_worked,1)
    blase_salary_by_hour = round(blase_salary/blase_time_worked,1)

    #time back office
    requin_backoffice = round(random.uniform(0.00, 0.05),2)
    experimente_backoffice = round(random.uniform(0.05, 0.1),2)
    jeune_backoffice = round(random.uniform(0.10, 0.15),2)
    etudiant_backoffice = round(random.uniform(0.2, 0.25),2)
    blase_backoffice = round(random.uniform(0.2, 0.3),2)


    #time front office
    requin_frontoffice = 1-requin_backoffice
    experimente_frontoffice = 1-experimente_backoffice
    jeune_frontoffice = 1-jeune_backoffice
    etudiant_frontoffice = 1-etudiant_backoffice
    blase_frontoffice = 1-blase_backoffice
    

    profiles = {
        "Requin": {
            "conversion_rate": 0.33,  # très haut taux de conversion
            #"sales_per_day": 15,      # nombre de ventes typiques par jour
            #"avg_basket": 1.4,       # panier moyen relatif (40% supérieur à la moyenne du magasin)
            "salary": requin_salary, 
            "hire_date": requin_hire_date,
            "anciennete_mois": (datetime.now().date() - requin_hire_date).days -12,
            "role": random.choices(role, weights=[0.2, 0.8, 0])[0],
            "salary_by_hour": requin_salary_by_hour,
            "average_day_time_frontoffice": requin_frontoffice,
            "average_day_time_backoffice": requin_backoffice
            
        },
        "Expérimenté": {
            "conversion_rate": 0.25,
            #"sales_per_day": 10,
            #"avg_basket": 1.10,
            "salary": experimente_salary,
            "hire_date": experimente_hire_date,
            "anciennete_mois": (datetime.now().date() - experimente_hire_date).days -12,
            "role": random.choices(role, weights=[0.3, 0.7, 0])[0],
            "salary_by_hour": experimente_salary_by_hour,
            "average_day_time_frontoffice": experimente_frontoffice,
            "average_day_time_backoffice": experimente_backoffice
        },
        "Jeune prometteur": {
            "conversion_rate": 0.18,
            #"sales_per_day": 8,
            #"avg_basket": 0.90,
            "salary": jeune_salary,
            "hire_date": jeune_hire_date,
            "anciennete_mois": (datetime.now().date() - jeune_hire_date).days -12,
            "role": role[1],
            "jeune_salary_by_hour": jeune_salary_by_hour,
            "average_day_time_frontoffice": jeune_frontoffice,
            "average_day_time_backoffice": jeune_backoffice
        },
        "étudiants": {
            "conversion_rate": 0.10,
            #"sales_per_day": 5,
            #"avg_basket": 0.75,
            "salary": etudiant_salary,
            "hire_date": etudiant_hire_date ,
            "anciennete_mois": (datetime.now().date() - etudiant_hire_date).days -12,
            "role": role[-1],
            "etudiant_salary_by_hour": etudiant_salary_by_hour,
            "average_day_time_frontoffice": etudiant_frontoffice,
            "average_day_time_backoffice": etudiant_backoffice
        },
        "Blasé": {
            "conversion_rate": 0.12,
            #"sales_per_day": 6,
            #"avg_basket": 0.85,
            "salary": blase_salary,
            "hire_date": blase_hire_date,
            "anciennete_mois": (datetime.now().date() - blase_hire_date).days -12,
            "role": random.choices(role, weights=[0.05, 0.95, 0])[0],
            "blase_salary_by_hour": blase_salary_by_hour,
            "average_day_time_frontoffice": blase_frontoffice,
            "average_day_time_backoffice": blase_backoffice
        }
    }
    
    return profiles


def generate_employees(stores):
    
  
    employees = []
    emp_id_counter = 1
    for store in stores:
        store_type=store["type"]
        for _ in range(store["num_employees"]):
            profiles = emp_profile(stores)
            #print(base_profile)
            # Choix aléatoire d'un profil de vendeur
            if store_type == "Standard" :                           #requin,expérimenté,jeune,stagiaire,blasé
                profile_type = random.choices(list(profiles.keys()), weights=[0.1, 0.25, 0.25, 0.15, 0.3])[0]
            elif store_type == "Premium" :
                profile_type = random.choices(list(profiles.keys()), weights=[0.2, 0.3, 0.25, 0.15, 0.1])[0]
            else:#discount
                profile_type = random.choices(list(profiles.keys()), weights=[0.02, 0.13, 0.35, 0.25, 0.25])[0]
            base_profile = profiles[profile_type]
            # Ajustement aléatoire des performances pour varier légèrement par employé
            conv_rate = round(base_profile["conversion_rate"] * random.uniform(0.9, 1.1), 2)
            #sales_per_day = int(base_profile["sales_per_day"] * random.uniform(0.8, 1.2))
            #avg_basket_mult = round(base_profile["avg_basket"] * random.uniform(0.9, 1.1), 2)
            # Création de l'enregistrement de l'employé          
            
            employee = {
                "employee_id": f"E{emp_id_counter:04d}",
                "nom_complet": fake.unique.name(),
                "store_id": store["store_id"],
                "profile": profile_type,
                "conversion_rate": conv_rate,
                #"sales_per_day": sales_per_day, 
                #"avg_basket_multiplier": avg_basket_mult,
                "salary": base_profile["salary"],
                "anciennete_mois": (datetime.now().date() - base_profile["hire_date"]).days // 30,
                "hire_date": base_profile["hire_date"].strftime("%Y-%m-%d"),
                "role": base_profile["role"],
                "average_day_time_backoffice": base_profile["average_day_time_backoffice"],
                "average_day_time_frontoffice": base_profile["average_day_time_frontoffice"]
                #"salaire_horaire": round(12 + (perf * 8), 2),
                #"prime_performance": round(perf * 15, 2),
                #"score_productivite": round(perf, 3)
                #Temps reserve
                #Temps temps client 
                #Salaire horaire
                
                
            }
            employees.append(employee)
            emp_id_counter += 1
    return employees

# 3. ARTICLES ET STRATÉGIE DE PRIX (Products and Pricing)
# Génère des articles (chaussures) avec attribution de marque et catégorie.
# Introduit des magasins spécialisés dans certaines marques (via la correspondance produit-magasin plus tard).
# Applique des variations de prix dynamiques basées sur la saisonnalité et les promotions lors des ventes.
# Marque certains articles comme best-sellers et simule une rotation de stock plus élevée pour ceux-ci.

def generate_products():
    fake = Faker()
    brands = ["Nike", "Adidas", "Puma", "Reebok", "Asics", "New Balance", "Jordans"]
    categories = ["Running", "Basketball", "Training", "Casual", "Trail", "Limited Edition"]
    colors = ["Red Blood", "Deep Blue", "Electric Blue", "Black", "Premium Black", "White", "Light Green", "Sunny Yellow", "Classic Grey","Brown Bear", "Deep Purple", "Pink", "Gold"]
    sizes = ["30", "31", "33", "34", "32", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"]
    models = ["Pro", "Air", "Max", "Flex", "Elite", "Zoom"]
    
    products = []
    existing_products = set()
    price_cache = {}
    
    for i in range(1, num_products+1):
        while True:
            brand = random.choice(brands)
            category = random.choice(categories)
            size = int(random.choice(sizes))
            model = random.choice(models)
            
            # Définir un prix unique pour chaque combinaison marque + modèle
            model_key = (brand, model)
            if model_key not in price_cache:
                base_price = (
                    Decimal(random.choice([190, 195, 200, 215, 229, 255, 249, 259]))
                    if category == "Limited Edition"
                    else Decimal(random.choice([60, 79, 85, 110, 129, 139, 145, 159, 169]))
                )
                if brand in ["Nike", "Adidas", "Jordans"]:
                    Decimal(10)
                price_cache[model_key] = base_price
            else:
                base_price = price_cache[model_key]
            
            is_best_seller = random.random() < 0.15
            if is_best_seller:
                base_price *= Decimal(1.1)
                base_price = base_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            # Réduction pour les tailles enfant (< 36)
            if size < 36:
                base_price -= Decimal(30)
            
            key = (brand, model, category, size, base_price, is_best_seller)
            
            if key not in existing_products:
                existing_products.add(key)
                break
      
        color = random.choice(colors)

        if color == "gold" or color == "Premium Black": # couleur spéciale
            base_price += Decimal(30)

        
        product = {
            "product_id": f"P{i:03d}",
            "brand": brand,
            "model": model,
            "category": category,
            "color": color,
            "size": size,
            "base_price": float(base_price),
            "is_best_seller": is_best_seller
        }
        
        #print(i,base_price)
        products.append(product)
    print(products)   
    return products

# 4. CLIENTS ET CARTE DE FIDÉLITÉ (Customers and Loyalty Card)
# Génère des profils clients distincts (sneakerhead, acheteur impulsif, chasseur de promos, fidèle à une marque).
# Implémente un système de fidélité avec accumulation de points et possibilités de remises via ces points.
# Répartit aléatoirement les clients entre fidèles (carte de fidélité) et occasionnels.

def generate_customers():
    profile_types = ["sneakerhead", "impulsif", "chasseur_de_promos", "fidèle_marque"]
    brands = ["Nike", "Adidas", "Puma", "Reebok", "Asics", "New Balance", "Jordans"]
    customers = []
    
    for i in range(1, num_customers+1):
        profile = random.choice(profile_types)
        # Attribution de la carte de fidélité en fonction du profil (probabilités différentes)
        if profile == "sneakerhead":
            has_card = (random.random() < 0.9)
        elif profile == "fidèle_marque":
            has_card = (random.random() < 0.8)
        elif profile == "chasseur_de_promos":
            has_card = (random.random() < 0.7)
        else:  # impulsif
            has_card = (random.random() < 0.4)
        # Si fidèle à une marque, on définit sa marque favorite
        favorite_brand = random.choice(brands) if profile == "fidèle_marque" else None
        # Points de fidélité initiaux (si le client a une carte, simulant un historique d'achats)
        initial_points = random.randint(0, 200) if has_card else 0
        if profile == "chasseur_de_promos":
            initial_points += 200
        
        customer = {
            "customer_id": f"C{i:04d}",
            "genre": random.choice(['M', 'F']),
            "age": int(skewnorm.rvs(4, loc=30, scale=15)), ### a améliorer l'âge pour profiler
            "profile": profile,
            "favorite_brand": favorite_brand,
            "has_loyalty_card": has_card,
            "loyalty_points": initial_points
        }
        customers.append(customer)
    return customers 

def find_nearest_saturday(date):
    # Trouve le samedi le plus proche de la date donnée
    week= date.isocalendar()[1]
    year = date.isocalendar()[0]
    nearest_saturday = date.fromisocalendar(year, week, 6)  # 6 = samedi
    return nearest_saturday

# 5. VENTES ET INTELLIGENCE MÉTIER (Sales and Business Intelligence)
# Modélise les ventes en assurant des écarts réalistes entre magasins (magasin Premium vs Hard Discount).
# Implémente des variations saisonnières (mois) et identifie les jours de forte affluence (week-ends, événements).
# Assure la cohérence absolue entre l’employé, le client, le produit, le prix et le magasin dans chaque vente.

Month31 = [1,3,5,7,8,10,12]
Month30 = [4,6,9,11]

def generate_sales(stores, employees, products, customers):
    sales = []
    sale_id_counter = 1
    
    # Indexation des employés par magasin pour un accès rapide lors de la sélection
    employees_by_store = {}
    for emp in employees:
        employees_by_store.setdefault(emp["store_id"], []).append(emp)
    
    
    
    # Pré-calcul des clients "compatibles" par magasin (un client fidèle à une marque n'est inclus que si le magasin vend cette marque)
    customers_by_store = {}
    for store in stores:
        store_id = store["store_id"]
        compatible_customers = []
        for cust in customers:
            if cust["profile"] == "fidèle_marque":
                # Inclure le client fidèle seulement si sa marque favorite est vendue dans ce magasin
                if cust["favorite_brand"] in store["specialty_brands"]:
                    compatible_customers.append(cust)
            else:
                compatible_customers.append(cust)
        customers_by_store[store_id] = compatible_customers
    
    # Facteurs saisonniers par mois (1.0 = moyenne, >1 = haute saison, <1 = basse saison)
    seasonal_factor = {
        1: 0.8,  2: 0.9,  3: 1.0,  4: 1.1,  5: 1.0,  6: 1.0,
        7: 0.9,  8: 0.95, 9: 1.1, 10: 1.2, 11: 1.3, 12: 1.5
    }
    year = 2024  # année de simulation des ventes


    # Indexation des produits par marque pour restreindre le choix des articles par spécialisation de magasin
    products_by_brand = {}
    for prod in products:
        products_by_brand.setdefault(prod["brand"], []).append(prod)

        
    for store in stores:
        # Calcul du nombre moyen de ventes mensuelles pour ce magasin (en fonction du trafic et du taux de conversion)
        base_monthly_sales = int(store["daily_foot_traffic"] * store["conversion_rate"] * 30)
            
        
        if store["type"] == "Premium":
            # Magasin Premium : moins de transactions mais panier plus élevé (on s'assure d'un minimum de 50% du volume standard)
            base_monthly_sales = max(base_monthly_sales, int(0.6 * base_monthly_sales))
            ajust_val = float(random.choice(['0','5', '10']))
            
        elif store["type"] == "Discount":
            # Magasin Discount : volume de ventes plus élevé (ex: +20% vs un standard équivalent)
            base_monthly_sales = int(base_monthly_sales * 1.1)
                    # Dans un magasin Discount, on applique une légère réduction supplémentaire
            ajust_val = -float(random.choice(['0','5', '10']))

            
        for month in range(1, 13):
            # Ajustement du volume de ventes en fonction de la saison (mois)
            month_sales_count = int(base_monthly_sales * seasonal_factor.get(month, 1.0))
            if month_sales_count < 1:
                continue  # si le calcul donne 0 (trafic très faible), on passe ce mois



            ################################################################
            #####    SALES GEN
            ####################################################
            addgoodies = False
            

            CA_month=0
            for _ in range(month_sales_count):
                match addgoodies:

                    case True:
                        addgoodies = False

                        goodies = random.choices(["Lacets", "Echarpe", "Bonnet","Tee-short","Lunettes"])[0]
                        goodiesprice = int(random.choices(["20", "40", "10","30"])[0])
                        
                        CA_month += goodiesprice
                        
                        sale = {
                            "sale_id": f"V{uniqueId}",
                            "date": sale_date.strftime("%Y-%m-%d"),
                            "time": sale_random_time.strftime("%H:%M"),

                            
                            "store_id": store["store_id"],
                            "store_type": store["type"],
                            "zone": store["zone"],
                            "surface": store["surface"],
                            "hyper": store["hyper"],
                            "specialty_brands": store["specialty_brands"],
                            "open_time" : store["open_time"],
                            "open_to_clients_hours" : store["open_to_clients_hours"],
                            "open_days" : store["open_days"],
                            "foot_traffic_by_hour" : store["foot_traffic_by_hour"],
                            "daily_foot_traffic": store["daily_foot_traffic"],
                            #"conversion_rate": store["conversion_rate"],
                            #"traffic_conversion": store["traffic_conversion"],
                            #"avg_basket_value": store["avg_basket_value"],
                            #"monthly_revenue_est": store["monthly_revenue_est"],
                            "nb_employees": store["num_employees"],

                            
                            "employee_id": employee["employee_id"],
                            "employee_profile": employee["profile"],
                            "monthly_salary": employee["salary"],
                            "anciennete_mois": employee["anciennete_mois"],
                            "hire_date": employee["hire_date"],
                            "job_role": employee["role"],
                            "average_day_time_backoffice": employee["average_day_time_backoffice"],
                            "average_day_time_frontoffice": employee["average_day_time_frontoffice"],
                            
                            
                            "customer_id": customer["customer_id"],
                            "genre": customer["genre"],
                            "age": customer["age"], ### a améliorer l'âge pour profiler
                            "favorite_brand": customer["favorite_brand"],
                            "has_loyalty_card": customer["has_loyalty_card"],
                            "customer_profile": customer["profile"],
                            "loyalty_points_used": points_redeemed,
                            "loyalty_points_earned": points_earned,
                            
                            "product_id": "G" + product["product_id"][1:],
                            "brand": goodies,
                            "category": goodies,
                            "model": goodies,
                            "color": "None",
                            "size": random.choices(["L", "S", "M","XL","XS"])[0],
                            "price_sold": goodiesprice,
                            "base_price": goodiesprice,
                            "is_best_seller": "False",
                        
                            "total_discount_applied": 0,
                            "discount_applied_profile": 0,
                            "discount_value_fidelity": 0,
                            "ajust_value_magasin": 0,
                            "discount_val_month": 0,
                            "%economise": 0
                        }
                        if employee["profile"] == "Requin" and random.random() < 0.17 :
                            addgoodies = True
                        if employee["profile"] == "Expérimenté" and random.random() < 0.07 :
                            addgoodies = True
                        if customer["profile"] == "impulsif" and random.random() < 0.17 :
                            addgoodies = True

                        
                        




                    case False:
                        
                    
                        ######## Month #######
                        if month in Month31 :
                        # Sélection d'une date aléatoire dans le mois 
                            day = random.randint(1, 31)  # on limite à 31,30 ou 28 pour février
                        elif month in Month30 :
                            day = random.randint(1, 30)
                        else:
                            day = random.randint(1, 28)
                        
                        sale_date = datetime(year, month, day)
                        if random.random() < 0.12:
                            # 15% de chances de décaler la vente sur le week-end si elle n'y est pas
                            if sale_date.weekday() < 5:  # 0=lun, 4=ven -> jour de semaine
                                sale_date = find_nearest_saturday(sale_date)  # on décale au samedi
                            
                        if sale_date.weekday() > 5:  # 0=lun, 4=ven 6=dimanche -> jour de semaine
                            sale_date -= timedelta(days=(random.randint(1, 6) - sale_date.weekday()))
                        if sale_date.month != month:
                            # Correction si le décalage a fait sortir du mois
                            sale_date -= timedelta(weeks=1)

                        ######## Sale time #######
                        #Calcul d'une heure de vente potentielle on récupère l'étendue d'ouverture du magasin
                        potential_sale_time = store["open_time"]
                        random_hour = random.randint(9, 9 + potential_sale_time) # possible de travailler un linspace avec des valeur plus probable si besoin
                        random_minute = random.randint(0, 59)
                        # Création d'un objet datetime.time aléatoire
                        sale_random_time = time(random_hour, random_minute)


                        ####### employé qui vend #########
                        # Choix d'un employé du magasin pour cette vente, pondéré par ses performances (ventes/jour)
                        store_emp_list = employees_by_store.get(store["store_id"], [])
                        if not store_emp_list:
                            continue  # pas d'employé pour ce magasin (cas théorique à éviter)
                        emp_weights = [emp["conversion_rate"] for emp in store_emp_list]
                        employee = random.choices(store_emp_list, weights=emp_weights, k=1)[0]
                        if random.random() < 0.1:
                            addgoodies = True        
                
                                   

                        ####### client qui achète #########
                        # Choix d'un client présent pour cette vente parmi ceux compatibles avec le magasin
                        possible_customers = customers_by_store[store["store_id"]]
                        customer = random.choice(possible_customers)
                        
                        # Sélection de la marque de produit pour cette vente en fonction du client et du magasin
                        if customer["profile"] == "fidèle_marque" and customer["favorite_brand"] in store["specialty_brands"]:
                            # Client fidèle à une marque, on choisit sa marque favorite (disponible dans le magasin)
                            chosen_brand = customer["favorite_brand"]
                            chosen_brand2 = customer["favorite_brand"]
                            chosen_brand3 = customer["favorite_brand"]
                        else:
                            # Sinon, on choisit une marque que le magasin propose
                            chosen_brand = random.choice(store["specialty_brands"])
                            chosen_brand2 = random.choice(store["specialty_brands"])
                            chosen_brand3 = random.choice(store["specialty_brands"])

                            
                        # Sélection d'un produit de la marque choisie
                        available_products = products_by_brand.get(chosen_brand, [])
                        if not available_products:
                            # Récupération de tous les produits disponibles dans ce magasin (toutes marques confondues)
                            store_products = []
                            for b in store["specialty_brands"]:
                                store_products.extend(products_by_brand.get(b, []))
                            chosen_brand = random.choice(store_products)
                            chosen_brand2 = random.choice(store_products)
                            chosen_brand3 = random.choice(store_products)
                            continue  # si aucun produit de cette marque (ne devrait pas arriver vu la génération)

                    
                        # Récupération de tous les produits disponibles dans ce magasin (toutes marques confondues)
                        store_products = []
                        for b in store["specialty_brands"]:
                            store_products.extend(products_by_brand.get(b, []))
                        # Filtrer les produits "hype" (best-sellers ou éditions limitées)
                        hype_products = [p for p in store_products if p["is_best_seller"] or p["category"] == "Limited Edition"]
                        
                        
                        # Si le client est un sneakerhead, il aura tendance à choisir un best-seller ou une édition limitée s'il y en a
                        if customer["profile"] == "sneakerhead":
                            
                            
                            if hype_products and random.random() < 0.7:
                                product = random.choice(hype_products)
                            else:
                                product = random.choice(store_products)
                        else:
                            product = random.choice(available_products)
                            


                        #si le vendeur est un requin alors plus de chance de vendre un produit cher ou rare

                        if hype_products and employee["profile"] == "Requin" and random.random() < 0.8:
                            product = random.choice(hype_products)
                            
                            i = 0
                            while product["base_price"] < 180:
                                i += 1
                                product = random.choice(hype_products)

                                if i > 10:  
                                    break  
                            
                        ##########################################################
                    
                        # Prix du produit

                        ####################################################"
                        
                        original_base_price = product["base_price"]
                        price = original_base_price
                        
                        ajust_applied = 0
                        ajust_val_magasin = 0
                        # Dans un magasin Discount, on applique une légère réduction supplémentaire  Dans un magasin Premium, possibilité d'une légère majoration (service haut de gamme, exclusivité)
                        
                        price += round(ajust_val*price/100,2)
                        ajust_applied += ajust_val
                        ajust_val_magasin = price
                        #print(ajust_val,price,ajust_applied,ajust_val_magasin)
                        
                        
                        discount_applied = 0
                        total_discount_applied = 0
                        
                        discount_val_month = 0
                        # Variations de prix dynamiques (promotions saisonnières, soldes, etc.)
                        if product["is_best_seller"]:
                            # Les best-sellers sont rarement soldés (faible chance de promo)
                            if random.random() < 0.02:
                                discount = random.uniform(0.05, 0.1)  # petite remise 5-10%
                                discount_val = round(float(price * discount),2)
                                price -= discount_val
                                discount_applied += discount_val
                                discount_val_month = discount_val
                        else:
                            # Autres produits : soldes en janvier/juillet ou promo aléatoire
                            if month in [1, 7] and random.random() < 0.2: #20% qu'un produit soit une vente soldée sur janvier et decemebre
                                discount = float(random.choice(['0.05', '0.1','0.15', '0.20','0.25','0.30']))  # remise 10-30%
                                if random.random() < 0.1: #on rajoute une remise supplémentaire àléatoire rare (produit abimé etc.)
                                    discount += 0.1 
                                discount_val = round(float(price * discount),2)
                                price -= discount_val
                                discount_applied += discount_val
                            elif month not in [1, 7] and random.random() < 0.1: #10% le reste du temps
                                discount = float(random.choice(['0.05', '0.1','0.15', '0.20','0.25','0.30']))  # remise 10-30%
                                if random.random() < 0.1: #on rajoute une remise supplémentaire àléatoire rare (produit abimé etc.)
                                    discount += 0.1 
                                discount_val = round(float(price * discount),2)
                                price -= discount_val
                                discount_applied += discount_val
                                discount_val_month = discount_val
                                
                        
                            
                         
                        
                        # Système de fidélité : gain et utilisation des points
                        points_earned = 0
                        points_redeemed = 0
                        discount_value_fidelity = 0
                        
                        if customer["has_loyalty_card"]:
                            # Accumulation de points (ex: 10% du montant de l'achat converti en points)
                            points_earned = int(price * 0.1)
                            
                            # Utilisation occasionnelle de points si suffisamment accumulés
                            if customer["loyalty_points"] >= 100 and random.random() < 0.15 :
                                # Le client utilise des points pour obtenir une remise
                                redeem_points = min(customer["loyalty_points"], random.choice(range(10,50,10)))
                                discount_value = int(min(redeem_points * 0.1, price * 0.5))  # chaque point vaut 0.1€, limite 50% du prix
                                price -= discount_value
                                points_redeemed = redeem_points
                                customer["loyalty_points"] -= redeem_points
                                discount_applied += discount_value
                                discount_value_fidelity = discount_value
                                 
                            customer["loyalty_points"] += points_earned #on attribue les points après car il ne peut pas les utiliser tout de suite

                        discount_applied_profile = 0    
                        # Si le client est un chasseur de promos, on s'assure qu'il bénéficie d'une remise s'il n'y en a pas eu
                        if customer["profile"] == "chasseur_de_promos" and discount_applied == 0:
                            if random.random() < 0.25: #25% du temps             
                                promo_disc = int(price * random.uniform(0.1, 0.2))  # 10-20% de remise supplémentaire
                                price -= promo_disc
                                discount_applied += promo_disc
                                discount_applied_profile = promo_disc
                        elif customer["profile"] != "chasseur_de_promos" and discount_applied == 0:
                            if random.random() < 0.08: #8% du temps  si pas chassuer de promo           
                                promo_disc = int(price * random.uniform(0.5, 0.15))  
                                price -= promo_disc
                                discount_applied += promo_disc
                                discount_applied_profile = promo_disc
                                
                        total_discount_applied = discount_val_month + discount_value_fidelity + discount_applied_profile


                        #possibilité de doubler la vente : 

                        if employee["profile"] == "Requin" and random.random() < 0.25 :
                            addgoodies = True
                        if employee["profile"] == "Expérimenté" and random.random() < 0.1 :
                            addgoodies = True
                        if customer["profile"] == "impulsif" and random.random() < 0.15 :
                            addgoodies = True 
                        
                        # Création de l'enregistrement de vente avec tous les liens et informations
                        CA_month += price
                        uniqueId= fake.unique.random_number(digits=10, fix_len=True)
                        sale = {
                            "sale_id": f"V{uniqueId}",
                            "date": sale_date.strftime("%Y-%m-%d"),
                            "time": sale_random_time.strftime("%H:%M"),

                            
                            "store_id": store["store_id"],
                            "store_type": store["type"],
                            "zone": store["zone"],
                            "surface": store["surface"],
                            "hypermarche": store["hyper"],
                            "specialty_brands": store["specialty_brands"],
                            "open_time_int" : store["open_time"],
                            "open_to_clients_hours" : store["open_to_clients_hours"],
                            "open_days" : store["open_days"],
                            "foot_traffic_by_hour" : store["foot_traffic_by_hour"],
                            "daily_foot_traffic": store["daily_foot_traffic"],
                            #"conversion_rate_store": store["conversion_rate"],
                            #"traffic_conversion": store["traffic_conversion"],
                            #"avg_basket_value": store["avg_basket_value"],
                            #"monthly_revenue_est": store["monthly_revenue_est"],
                            "nb_employees": store["num_employees"],

                            
                            "employee_id": employee["employee_id"],
                            "employee_profile": employee["profile"],
                            "monthly_salary": employee["salary"],
                            "anciennete_mois": employee["anciennete_mois"],
                            "hire_date": employee["hire_date"],
                            "job_role": employee["role"],
                            "average_day_time_backoffice": employee["average_day_time_backoffice"],
                            "average_day_time_frontoffice": employee["average_day_time_frontoffice"],
                            
                            
                            "customer_id": customer["customer_id"],
                            "genre": customer["genre"],
                            "age": customer["age"], ### a améliorer l'âge pour profiler
                            "favorite_brand": customer["favorite_brand"],
                            "has_loyalty_card": customer["has_loyalty_card"],
                            "customer_profile": customer["profile"],
                            "loyalty_points_used": points_redeemed,
                            "loyalty_points_earned": points_earned,
                            
                            "product_id": product["product_id"],
                            "brand": product["brand"],
                            "category": product["category"],
                            "model": product["model"],
                            "color": product["color"],
                            "size": product["size"],
                            "price_sold": price,
                            "base_price": ajust_val_magasin,
                            "is_best_seller": product["is_best_seller"],
                        
                            "total_discount_applied": total_discount_applied,
                            "discount_applied_profile": discount_applied_profile,
                            "discount_value_fidelity": discount_value_fidelity,
                            "ajust_value_magasin": ajust_val,
                            "discount_val_month": discount_val_month,
                            "%economise": round((1 - price / ajust_val_magasin ) * 100, 1)
                        }
                sales.append(sale)
                sale_id_counter += 1
    return sales




##############################################################
######   EXPORT
#######################################"


# Exemple d'utilisation des fonctions (génération complète et affichage de quelques exemples)
if __name__ == "__main__":
    print("🛠 Génération des données...")
    stores = generate_stores()
    employees = generate_employees(stores)
    products = generate_products()
    customers = generate_customers()
    sales = generate_sales(stores, employees, products, customers)
    

    # Conversion en DataFrames pandas pour faciliter l'export
    df_stores = pd.DataFrame(stores)
    df_employees = pd.DataFrame(employees)
    df_products = pd.DataFrame(products)
    df_customers = pd.DataFrame(customers)
    df_sales = pd.DataFrame(sales)


    #Post traitement et validation Calcul du CA effectif

    
    df_sales['date'] = pd.to_datetime(df_sales['date'])

    # Extraire l'année et le mois de la date de chaque vente
    df_sales['year_month'] = df_sales['date'].dt.to_period('M')

    # Grouper par magasin et par mois, puis calculer le CA mensuel
    ca_mensuel = df_sales.groupby(['store_id', 'year_month'])['price_sold'].sum().reset_index()
    ca_mensuel.rename(columns={'price_sold': 'CA_month'}, inplace=True)

    # Fusionner le CA mensuel avec le DataFrame original
    df_sales = pd.merge(df_sales, ca_mensuel, on=['store_id', 'year_month'], how='left')

        
    
    # Export des CSV
    df_stores.to_csv('magasins.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)
    df_employees.to_csv('employes.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)
    df_products.to_csv('articles.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)
    df_customers.to_csv('clients.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)
    df_sales.to_csv('ventes.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)





#######################################
    ##### EXPORT ETUDIANT
    ####################################


    import pandas as pd

    # Supposons que df_stores, df_employees, df_products, df_customers et df_sales soient vos DataFrames existants

    # 1. Définir les colonnes à conserver pour chaque DataFrame
    #colonnes_stores = ['store_id', 'store_name', 'location']
    #colonnes_employees = ['employee_id', 'name', 'store_id']
    #colonnes_products = ['product_id', 'brand', 'model']
    #colonnes_customers = ['customer_id', 'name', 'email']

    
    #Option  1 FACILE
    colonnes_sales = [
    'sale_id', 
    'date', 
    'time',
    
    'store_id',
    'store_type',
    'zone',
    'surface',
    'open_to_clients_hours', 
    'open_days', 
    'foot_traffic_by_hour',
    
    'employee_id', 
    'monthly_salary',  
    'hire_date', 
    'job_role', 
    'average_day_time_backoffice', 
    'average_day_time_frontoffice', 
    'customer_id', 
    'genre', 
    'age',  
    'has_loyalty_card', 
    'loyalty_points_used', 
    'loyalty_points_earned',
    
    'product_id', 
    'price_sold',
    'base_price',
    'brand', 
    'category',
    'model',
    'size',
    'color', 
    'is_best_seller'
    ]
    # 2. Créer des DataFrames filtrés
    #df_stores_filtre = df_stores[colonnes_stores]
    #df_employees_filtre = df_employees[colonnes_employees]
    #df_products_filtre = df_products[colonnes_products]
    #df_customers_filtre = df_customers[colonnes_customers]
    df_sales_filtre = df_sales[colonnes_sales]

    # 3. Exporter les DataFrames filtrés en CSV avec le séparateur ';'
    #df_stores_filtre.to_csv('magasins_filtre.csv', sep=';', encoding='utf-8-sig', index=False)
    #df_employees_filtre.to_csv('employes_filtre.csv', sep=';', encoding='utf-8-sig', index=False)
    #df_products_filtre.to_csv('articles_filtre.csv', sep=';', encoding='utf-8-sig', index=False)
    #df_customers_filtre.to_csv('clients_filtre.csv', sep=';', encoding='utf-8-sig', index=False)
    df_sales_filtre.to_csv('ventes_filtre.csv', sep=';', decimal=',', encoding='utf-8-sig', index=False)





    # Affichage d'extraits de données générées pour vérification
    print("Stores (exemple) :")
    for s in stores[:2]:
        print(s)
    print("\nEmployés (exemple) :")
    for e in employees[:3]:
        print(e)
    print("\nProduits (exemple) :")
    for p in products[:3]:
        print(p)
    print("\nClients (exemple) :")
    for c in customers[:3]:
        print(c)
    print(f"\nTotal des ventes générées : {len(sales)}")
    print("Ventes (exemple) :")
    for v in sales[:3]:
        print(v)
print("✅ Génération terminée avec succès!")

    

