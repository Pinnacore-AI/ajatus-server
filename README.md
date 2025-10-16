_# AjatusServer

**AjatusServer** is the central API and orchestrator for the Ajatuskumppani ecosystem. It handles user authentication, task management, and communication between the various components.

## Features

-   **FastAPI**: Built on the high-performance FastAPI framework.
-   **PostgreSQL**: Uses PostgreSQL with `pgvector` for storing data and vector embeddings.
-   **Orchestration**: Manages the lifecycle of AI tasks and agents.
-   **Authentication**: Secure JWT-based authentication.

## Getting Started

### Prerequisites

-   Python 3.11+
-   PostgreSQL 15+
-   Redis

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/pinnacore-ai/ajatuskumppani.git
    cd ajatuskumppani/ajatus-server
    ```
2.  Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### Usage

To start the server, use the following command:

```bash
uvicorn api.main:app --reload
```

## License

This project is licensed under the **AGPL 3.0 License**. See the [LICENSE](LICENSE) file for details.

