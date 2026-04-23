import streamlit as st
import cv2
import numpy as np
from PIL import Image

st.set_page_config(page_title="ClimbVision", layout="wide")

# --- NAVIGATION ---
page = st.sidebar.selectbox("Navigation", ["Scanner une Voie", "Mon Logbook & Stats", "Entraînement"])

# --- FONCTION IA (Scanner) ---
def process_image(img_array, color_target):
    # Conversion pour OpenCV
    img_bgr = cv2.cvtColor(np.array(img_array), cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    
    if color_target == "Orange":
        lower = np.array([10, 160, 100])
        upper = np.array([25, 255, 255])
    elif color_target == "Vert":
        lower = np.array([35, 100, 100])
        upper = np.array([85, 255, 255])
    else: # Rouge
        lower = np.array([0, 150, 100])
        upper = np.array([10, 255, 255])

    mask = cv2.inRange(hsv, lower, upper)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_3c = cv2.merge([gray, gray, gray])
    
    result_bgr = np.where(mask[:, :, None] == 255, img_bgr, gray_3c)
    return cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)

# --- PAGES ---
if page == "Scanner une Voie":
    st.title("📸 Scanner une Voie")
    
    uploaded_file = st.file_uploader("Choisissez une photo de mur", type=['jpg', 'jpeg', 'png'])
    
    if uploaded_file:
        col1, col2 = st.columns(2)
        image = Image.open(uploaded_file)
        col1.image(image, caption="Image originale")
        
        target_color = st.selectbox("Couleur à isoler", ["Orange", "Vert", "Rouge"])
        
        if st.button("Lancer le Scan"):
            processed_img = process_image(image, target_color)
            col2.image(processed_img, caption="Voie isolée")
            
            st.divider()
            st.subheader("Détails du bloc")
            c1, c2, c3 = st.columns(3)
            grade = c1.selectbox("Cotation", ["B1", "B2", "B3", "B4", "B5", "B6+"])
            status = c2.selectbox("Résultat", ["Flash", "Top", "En cours"])
            gym = c3.text_input("Salle", value="Block'Out")
            
            if st.button("Enregistrer dans le Logbook"):
                st.success(f"Bloc {grade} enregistré !")

elif page == "Mon Logbook & Stats":
    st.title("📊 Mes Statistiques")
    st.info("Ici s'afficheront vos graphiques de progression (Bientôt lié à Firebase).")
    
    # Simulation de données
    st.subheader("Historique récent")
    data = {
        "Date": ["23/10", "21/10", "19/10"],
        "Salle": ["Block'Out", "Arkose", "Block'Out"],
        "Cotation": ["B5", "B4", "B5"],
        "Statut": ["Flash", "Top", "Échec"]
    }
    st.table(data)

elif page == "Entraînement":
    st.title("💪 Séance d'Entraînement")
    exercises = ["Échauffement", "Tractions (3x10)", "Gainage (4 min)", "Suspensions Poutre"]
    selected = st.multiselect("Choisir vos exercices", exercises)
    
    custom_ex = st.text_input("Ajouter un exercice personnalisé")
    if custom_ex:
        st.write(f"Ajouté : {custom_ex}")
        
    if st.button("Valider la séance"):
        st.balloons()
        st.success("Séance enregistrée !")
    