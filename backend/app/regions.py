"""Bangladesh districts; centroids describe entire districts, never individual sites."""
DIVISIONS = {
    "Dhaka": "Dhaka Faridpur Gazipur Gopalganj Kishoreganj Madaripur Manikganj Munshiganj Narayanganj Narsingdi Rajbari Shariatpur Tangail".split(),
    "Chattogram": ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cumilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
    "Rajshahi": "Bogura Joypurhat Naogaon Natore Chapainawabganj Pabna Rajshahi Sirajganj".split(),
    "Khulna": "Bagerhat Chuadanga Jashore Jhenaidah Khulna Kushtia Magura Meherpur Narail Satkhira".split(),
    "Barishal": "Barguna Barishal Bhola Jhalokati Patuakhali Pirojpur".split(),
    "Sylhet": ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
    "Rangpur": "Dinajpur Gaibandha Kurigram Lalmonirhat Nilphamari Panchagarh Rangpur Thakurgaon".split(),
    "Mymensingh": "Jamalpur Mymensingh Netrokona Sherpur".split(),
}
# Deliberately coarse map points. Unmapped districts remain discoverable in the directory.
CENTROIDS = {"Dhaka": [23.8, 90.3], "Chattogram": [22.5, 91.9], "Rajshahi": [24.4, 88.6],
             "Khulna": [22.8, 89.4], "Barishal": [22.7, 90.3], "Sylhet": [24.9, 91.9],
             "Rangpur": [25.8, 89.2], "Mymensingh": [24.8, 90.4], "Gazipur": [24.1, 90.4],
             "Cumilla": [23.5, 91.1], "Narayanganj": [23.7, 90.6], "Tangail": [24.3, 89.9]}
AREAS = {"BD:" + d: {"code": "BD:" + d, "name": d, "division": division, "centroid": CENTROIDS.get(d)}
         for division, districts in DIVISIONS.items() for d in districts}
