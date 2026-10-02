/**
 * Synthetic Test Data Fixtures for CivicConnect Automated QA System
 * NEVER uses real personal data. Fully synthetic & deterministic.
 */

export const TEST_USERS = {
  citizen: {
    name: 'Sanjay Citizen (Test)',
    email: process.env.TEST_CITIZEN_EMAIL || 'citizen.test@civicconnect.com',
    password: process.env.TEST_CITIZEN_PASSWORD || 'Citizen@12345',
    role: 'CITIZEN',
    departmentId: null
  },
  admin: {
    name: 'System Administrator (Test)',
    email: process.env.TEST_ADMIN_EMAIL || 'admin@civicconnect.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    role: 'ADMIN',
    departmentId: null
  },
  departments: {
    roads: {
      id: 'roads',
      name: 'Roads & Infrastructure',
      manager: {
        email: 'roads.dept@civicconnect.com',
        password: 'Dept@Roads123',
        name: 'Roads Manager',
        role: 'DEPARTMENT',
        departmentId: 'roads'
      },
      engineer: {
        email: 'roads.eng1@civicconnect.com',
        password: 'Eng@Roads1234',
        name: 'Lead Engineer (Roads)',
        role: 'ENGINEER',
        departmentId: 'roads'
      }
    },
    water: {
      id: 'water',
      name: 'Water Supply',
      manager: {
        email: 'water.dept@civicconnect.com',
        password: 'Dept@Water123',
        name: 'Water Manager',
        role: 'DEPARTMENT',
        departmentId: 'water'
      },
      engineer: {
        email: 'water.eng1@civicconnect.com',
        password: 'Eng@Water1234',
        name: 'Lead Engineer (Water)',
        role: 'ENGINEER',
        departmentId: 'water'
      }
    },
    electricity: {
      id: 'electricity',
      name: 'Electricity & Lighting',
      manager: {
        email: 'electricity.dept@civicconnect.com',
        password: 'Dept@Electricity123',
        name: 'Electricity Manager',
        role: 'DEPARTMENT',
        departmentId: 'electricity'
      },
      engineer: {
        email: 'electricity.eng1@civicconnect.com',
        password: 'Eng@Electricity1234',
        name: 'Lead Engineer (Electricity)',
        role: 'ENGINEER',
        departmentId: 'electricity'
      }
    },
    garbage: {
      id: 'garbage',
      name: 'Sanitation & Waste',
      manager: {
        email: 'garbage.dept@civicconnect.com',
        password: 'Dept@Garbage123',
        name: 'Sanitation Manager',
        role: 'DEPARTMENT',
        departmentId: 'garbage'
      },
      engineer: {
        email: 'garbage.eng1@civicconnect.com',
        password: 'Eng@Garbage1234',
        name: 'Lead Engineer (Sanitation)',
        role: 'ENGINEER',
        departmentId: 'garbage'
      }
    },
    drainage: {
      id: 'drainage',
      name: 'Drainage & Sewage',
      manager: {
        email: 'drainage.dept@civicconnect.com',
        password: 'Dept@Drainage123',
        name: 'Drainage Manager',
        role: 'DEPARTMENT',
        departmentId: 'drainage'
      },
      engineer: {
        email: 'drainage.eng1@civicconnect.com',
        password: 'Eng@Drainage1234',
        name: 'Lead Engineer (Drainage)',
        role: 'ENGINEER',
        departmentId: 'drainage'
      }
    },
    health: {
      id: 'health',
      name: 'Public Health',
      manager: {
        email: 'health.dept@civicconnect.com',
        password: 'Dept@Health123',
        name: 'Public Health Manager',
        role: 'DEPARTMENT',
        departmentId: 'health'
      },
      engineer: {
        email: 'health.eng1@civicconnect.com',
        password: 'Eng@Health1234',
        name: 'Lead Engineer (Public Health)',
        role: 'ENGINEER',
        departmentId: 'health'
      }
    },
    transport: {
      id: 'transport',
      name: 'Transport & Traffic',
      manager: {
        email: 'transport.dept@civicconnect.com',
        password: 'Dept@Transport123',
        name: 'Transport Manager',
        role: 'DEPARTMENT',
        departmentId: 'transport'
      },
      engineer: {
        email: 'transport.eng1@civicconnect.com',
        password: 'Eng@Transport1234',
        name: 'Lead Engineer (Transport)',
        role: 'ENGINEER',
        departmentId: 'transport'
      }
    },
    public_safety: {
      id: 'public_safety',
      name: 'Public Safety',
      manager: {
        email: 'public_safety.dept@civicconnect.com',
        password: 'Dept@Safety123',
        name: 'Public Safety Manager',
        role: 'DEPARTMENT',
        departmentId: 'public_safety'
      },
      engineer: {
        email: 'public_safety.eng1@civicconnect.com',
        password: 'Eng@Safety1234',
        name: 'Lead Engineer (Public Safety)',
        role: 'ENGINEER',
        departmentId: 'public_safety'
      }
    }
  }
};

export const SAMPLE_COMPLAINTS = {
  roads: {
    description: 'Deep hazardous pothole on 5th Main Avenue causing vehicle damage and traffic bottleneck.',
    category: 'Roads & Infrastructure',
    lat: 17.7289,
    lng: 83.3031,
    address: '5th Main Avenue, Sector 4',
    imageURL: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'
  },
  water: {
    description: 'Major drinking water pipeline burst on sidewalk with heavy flow for several hours.',
    category: 'Water Supply',
    lat: 17.7321,
    lng: 83.3105,
    address: 'Water Tank Road, Block B',
    imageURL: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600'
  },
  electricity: {
    description: 'Exposed sparking live wire dangling from streetlight pole near school playground.',
    category: 'Electricity & Lighting',
    lat: 17.7401,
    lng: 83.3210,
    address: 'School Road, Sector 8',
    imageURL: 'https://images.unsplash.com/photo-1509390144018-eeaf6504a256?w=600'
  },
  garbage: {
    description: 'Overflowing municipal waste bin spilling onto pedestrian footpath creating foul smell.',
    category: 'Sanitation & Waste',
    lat: 17.7250,
    lng: 83.2980,
    address: 'Market Yard Lane',
    imageURL: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600'
  },
  drainage: {
    description: 'Blocked stormwater drain causing open sewage overflow on residential street.',
    category: 'Drainage & Sewage',
    lat: 17.7350,
    lng: 83.3050,
    address: 'Lowline Road, Ward 12',
    imageURL: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600'
  }
};
