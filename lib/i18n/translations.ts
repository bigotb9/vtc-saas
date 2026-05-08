/**
 * Traductions FR (défaut) / EN pour VTC Dashboard.
 *
 * Convention : les clés sont en camelCase, les valeurs sont des strings.
 * Variables dynamiques : {{name}} est remplacé par la valeur passée à t().
 *
 * Couverture : navigation, modules principaux, alertes, PDF, onboarding.
 */

export type Lang = "fr" | "en"

export const TRANSLATIONS = {
  fr: {
    // Navigation
    nav_dashboard:     "Tableau de bord",
    nav_vehicles:      "Véhicules",
    nav_drivers:       "Chauffeurs",
    nav_revenues:      "Recettes",
    nav_expenses:      "Dépenses",
    nav_clients:       "Clients",
    nav_activity:      "Journal d'activité",
    nav_ai_insights:   "AI Insights",
    nav_settings:      "Paramètres",
    nav_account:       "Mon compte",
    nav_yango:         "Partenariat Yango",

    // Dashboard
    dash_title:           "Tableau de bord",
    dash_today:           "Aujourd'hui",
    dash_vehicles_active: "Véhicules actifs",
    dash_drivers_active:  "Chauffeurs actifs",
    dash_revenue_month:   "Recettes ce mois",
    dash_alerts:          "Alertes",
    dash_no_alerts:       "Aucune alerte active",

    // Véhicules
    veh_title:       "Véhicules",
    veh_add:         "Ajouter un véhicule",
    veh_edit:        "Modifier",
    veh_docs:        "Documents",
    veh_maintenance: "Entretiens",
    veh_expenses:    "Dépenses",
    veh_active:      "Actif",
    veh_inactive:    "Inactif",

    // Chauffeurs
    drv_title:       "Chauffeurs",
    drv_add:         "Ajouter un chauffeur",
    drv_assigned:    "Véhicule assigné",
    drv_no_vehicle:  "Aucun véhicule assigné",
    drv_score:       "Score",

    // Recettes
    rev_title:       "Recettes",
    rev_import:      "Importer Wave",
    rev_total:       "Total",
    rev_period:      "Période",
    rev_driver:      "Chauffeur",
    rev_amount:      "Montant net",

    // Dépenses
    exp_title:       "Dépenses",
    exp_add:         "Ajouter une dépense",
    exp_category:    "Catégorie",
    exp_date:        "Date",
    exp_vehicle:     "Véhicule",

    // PDF / Rapports
    pdf_report:           "Rapport de flotte",
    pdf_vehicle_sheet:    "Fiche véhicule",
    pdf_period:           "Période :",
    pdf_generated_on:     "Généré le",
    pdf_confidential:     "Confidentiel",
    pdf_total_revenue:    "Total recettes",
    pdf_total_expenses:   "Total dépenses",
    pdf_net_profit:       "Bénéfice net",
    pdf_active_vehicles:  "Véhicules actifs",
    pdf_active_drivers:   "Chauffeurs actifs",

    // SYSCOHADA
    syscohada_export:     "Export SYSCOHADA",
    syscohada_period:     "Période comptable",
    syscohada_account:    "N° Compte",
    syscohada_label:      "Libellé",
    syscohada_debit:      "Débit",
    syscohada_credit:     "Crédit",

    // Alertes
    alert_doc_expiry:    "Document expire dans {{days}} jours",
    alert_payment_late:  "Paiement en retard — {{amount}} FCFA",
    alert_inactive_drv:  "{{name}} inactif depuis {{days}} jours",

    // Commun
    save:         "Sauvegarder",
    cancel:       "Annuler",
    delete:       "Supprimer",
    edit:         "Modifier",
    view:         "Voir",
    loading:      "Chargement…",
    error:        "Une erreur est survenue",
    confirm:      "Confirmer",
    close:        "Fermer",
    search:       "Rechercher…",
    no_data:      "Aucune donnée",
    fcfa:         "FCFA",
    month:        "mois",
    year:         "an",
    annual:       "Annuel",
    monthly:      "Mensuel",
  },

  en: {
    // Navigation
    nav_dashboard:     "Dashboard",
    nav_vehicles:      "Vehicles",
    nav_drivers:       "Drivers",
    nav_revenues:      "Revenue",
    nav_expenses:      "Expenses",
    nav_clients:       "Clients",
    nav_activity:      "Activity log",
    nav_ai_insights:   "AI Insights",
    nav_settings:      "Settings",
    nav_account:       "My account",
    nav_yango:         "Yango Partnership",

    // Dashboard
    dash_title:           "Dashboard",
    dash_today:           "Today",
    dash_vehicles_active: "Active vehicles",
    dash_drivers_active:  "Active drivers",
    dash_revenue_month:   "Revenue this month",
    dash_alerts:          "Alerts",
    dash_no_alerts:       "No active alerts",

    // Vehicles
    veh_title:       "Vehicles",
    veh_add:         "Add vehicle",
    veh_edit:        "Edit",
    veh_docs:        "Documents",
    veh_maintenance: "Maintenance",
    veh_expenses:    "Expenses",
    veh_active:      "Active",
    veh_inactive:    "Inactive",

    // Drivers
    drv_title:       "Drivers",
    drv_add:         "Add driver",
    drv_assigned:    "Assigned vehicle",
    drv_no_vehicle:  "No vehicle assigned",
    drv_score:       "Score",

    // Revenue
    rev_title:       "Revenue",
    rev_import:      "Import Wave",
    rev_total:       "Total",
    rev_period:      "Period",
    rev_driver:      "Driver",
    rev_amount:      "Net amount",

    // Expenses
    exp_title:       "Expenses",
    exp_add:         "Add expense",
    exp_category:    "Category",
    exp_date:        "Date",
    exp_vehicle:     "Vehicle",

    // PDF / Reports
    pdf_report:           "Fleet report",
    pdf_vehicle_sheet:    "Vehicle sheet",
    pdf_period:           "Period:",
    pdf_generated_on:     "Generated on",
    pdf_confidential:     "Confidential",
    pdf_total_revenue:    "Total revenue",
    pdf_total_expenses:   "Total expenses",
    pdf_net_profit:       "Net profit",
    pdf_active_vehicles:  "Active vehicles",
    pdf_active_drivers:   "Active drivers",

    // SYSCOHADA
    syscohada_export:     "SYSCOHADA Export",
    syscohada_period:     "Accounting period",
    syscohada_account:    "Account No.",
    syscohada_label:      "Label",
    syscohada_debit:      "Debit",
    syscohada_credit:     "Credit",

    // Alerts
    alert_doc_expiry:    "Document expires in {{days}} days",
    alert_payment_late:  "Late payment — {{amount}} FCFA",
    alert_inactive_drv:  "{{name}} inactive for {{days}} days",

    // Common
    save:         "Save",
    cancel:       "Cancel",
    delete:       "Delete",
    edit:         "Edit",
    view:         "View",
    loading:      "Loading…",
    error:        "An error occurred",
    confirm:      "Confirm",
    close:        "Close",
    search:       "Search…",
    no_data:      "No data",
    fcfa:         "FCFA",
    month:        "month",
    year:         "year",
    annual:       "Annual",
    monthly:      "Monthly",
  },
} as const

export type TranslationKey = keyof typeof TRANSLATIONS.fr
