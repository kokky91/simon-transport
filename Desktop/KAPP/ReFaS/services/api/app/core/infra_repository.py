from decimal import Decimal
from typing import Literal
from uuid import uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings

InfraMode = Literal["real", "sim"]


class InfraRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def get_world(self, tenant_id: str, mode: InfraMode, run_id: str | None = None) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT id, width_m, height_m
                    FROM real.farms
                    WHERE tenant_id::text = %s
                    ORDER BY created_at ASC
                    LIMIT 1
                    """,
                    (tenant_id,),
                )
                farm_row = cursor.fetchone()

                if not farm_row:
                    return None

                farm_id = str(farm_row["id"])
                width_m = self._to_float(farm_row["width_m"])
                height_m = self._to_float(farm_row["height_m"])

                if mode == "real":
                    cursor.execute(
                        """
                        SELECT id, name, crop_type, x_m, y_m, width_m, height_m
                        FROM real.fields
                        WHERE tenant_id::text = %s
                          AND farm_id = %s::uuid
                        ORDER BY created_at ASC
                        """,
                        (tenant_id, farm_id),
                    )
                    field_rows = cursor.fetchall()
                    cursor.execute(
                        """
                        SELECT id, field_id, type, x_m, y_m, width_m, height_m
                        FROM real.buildings
                        WHERE tenant_id::text = %s
                          AND farm_id = %s::uuid
                        ORDER BY created_at ASC
                        """,
                        (tenant_id, farm_id),
                    )
                    building_rows = cursor.fetchall()
                else:
                    if not run_id:
                        field_rows = []
                        building_rows = []
                    else:
                        cursor.execute(
                            """
                            SELECT id, name, crop_type, x_m, y_m, width_m, height_m
                            FROM sim.fields
                            WHERE tenant_id::text = %s
                              AND farm_id = %s::uuid
                              AND run_id = %s::uuid
                            ORDER BY created_at ASC
                            """,
                            (tenant_id, farm_id, run_id),
                        )
                        field_rows = cursor.fetchall()
                        cursor.execute(
                            """
                            SELECT id, field_id, type, x_m, y_m, width_m, height_m
                            FROM sim.buildings
                            WHERE tenant_id::text = %s
                              AND farm_id = %s::uuid
                              AND run_id = %s::uuid
                            ORDER BY created_at ASC
                            """,
                            (tenant_id, farm_id, run_id),
                        )
                        building_rows = cursor.fetchall()

        return {
            "mode": mode,
            "farm": {
                "id": farm_id,
                "width_m": width_m,
                "height_m": height_m,
            },
            "plots": [
                {
                    "id": str(row["id"]),
                    "label": row["name"],
                    "crop_type": row["crop_type"],
                    "x_m": self._to_float(row["x_m"]),
                    "y_m": self._to_float(row["y_m"]),
                    "width_m": self._to_float(row["width_m"]),
                    "height_m": self._to_float(row["height_m"]),
                }
                for row in field_rows
            ],
            "buildings": [
                {
                    "id": str(row["id"]),
                    "field_id": str(row["field_id"]) if row["field_id"] else None,
                    "type": row["type"],
                    "x_m": self._to_float(row["x_m"]),
                    "y_m": self._to_float(row["y_m"]),
                    "width_m": self._to_float(row["width_m"]),
                    "height_m": self._to_float(row["height_m"]),
                }
                for row in building_rows
            ],
        }

    def create_real_field(
        self,
        tenant_id: str,
        *,
        label: str,
        crop_type: str,
        x_m: float,
        y_m: float,
        width_m: float,
        height_m: float,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT id, width_m, height_m
                    FROM real.farms
                    WHERE tenant_id::text = %s
                    ORDER BY created_at ASC
                    LIMIT 1
                    """,
                    (tenant_id,),
                )
                farm_row = cursor.fetchone()

                if not farm_row:
                    return None

                farm_id = str(farm_row["id"])
                farm_width = self._to_float(farm_row["width_m"])
                farm_height = self._to_float(farm_row["height_m"])

                if x_m < 0 or y_m < 0 or width_m <= 0 or height_m <= 0:
                    raise ValueError("Field specs must be positive and position must be non-negative.")

                if x_m + width_m > farm_width or y_m + height_m > farm_height:
                    raise ValueError("Field exceeds farm boundaries.")

                field_id = str(uuid4())
                cursor.execute(
                    """
                    INSERT INTO real.fields (
                        id,
                        tenant_id,
                        farm_id,
                        name,
                        crop_type,
                        x_m,
                        y_m,
                        width_m,
                        height_m
                    ) VALUES (
                        %s::uuid,
                        %s::uuid,
                        %s::uuid,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    """,
                    (
                        field_id,
                        tenant_id,
                        farm_id,
                        label,
                        crop_type,
                        x_m,
                        y_m,
                        width_m,
                        height_m,
                    ),
                )
                connection.commit()

        return {
            "id": field_id,
            "label": label,
            "crop_type": crop_type,
            "x_m": x_m,
            "y_m": y_m,
            "width_m": width_m,
            "height_m": height_m,
        }

    def update_field_position(
        self,
        tenant_id: str,
        field_id: str,
        *,
        x_m: float,
        y_m: float,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        SELECT
                            f.id,
                            f.name,
                            f.crop_type,
                            f.width_m,
                            f.height_m,
                            farm.width_m AS farm_width_m,
                            farm.height_m AS farm_height_m
                        FROM real.fields f
                        JOIN real.farms farm ON farm.id = f.farm_id
                        WHERE f.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND f.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, field_id),
                    )
                    row = cursor.fetchone()
                    if not row:
                        return None

                    clamped_x, clamped_y = self._clamp_position(
                        x_m=x_m,
                        y_m=y_m,
                        width_m=self._to_float(row["width_m"]),
                        height_m=self._to_float(row["height_m"]),
                        farm_width_m=self._to_float(row["farm_width_m"]),
                        farm_height_m=self._to_float(row["farm_height_m"]),
                    )

                    cursor.execute(
                        """
                        UPDATE real.fields
                        SET x_m = %s, y_m = %s
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (clamped_x, clamped_y, tenant_id, field_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")

                    cursor.execute(
                        """
                        SELECT
                            f.id,
                            f.name,
                            f.crop_type,
                            f.width_m,
                            f.height_m,
                            farm.width_m AS farm_width_m,
                            farm.height_m AS farm_height_m
                        FROM sim.fields f
                        JOIN real.farms farm ON farm.id = f.farm_id
                        WHERE f.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND f.run_id = %s::uuid
                          AND f.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, run_id, field_id),
                    )
                    row = cursor.fetchone()
                    if not row:
                        return None

                    clamped_x, clamped_y = self._clamp_position(
                        x_m=x_m,
                        y_m=y_m,
                        width_m=self._to_float(row["width_m"]),
                        height_m=self._to_float(row["height_m"]),
                        farm_width_m=self._to_float(row["farm_width_m"]),
                        farm_height_m=self._to_float(row["farm_height_m"]),
                    )

                    cursor.execute(
                        """
                        UPDATE sim.fields
                        SET x_m = %s, y_m = %s
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (clamped_x, clamped_y, tenant_id, run_id, field_id),
                    )

                connection.commit()

        return {
            "id": field_id,
            "label": row["name"],
            "crop_type": row["crop_type"],
            "x_m": clamped_x,
            "y_m": clamped_y,
            "width_m": self._to_float(row["width_m"]),
            "height_m": self._to_float(row["height_m"]),
        }

    def update_building_position(
        self,
        tenant_id: str,
        building_id: str,
        *,
        x_m: float,
        y_m: float,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        SELECT
                            b.id,
                            b.field_id,
                            b.type,
                            b.width_m,
                            b.height_m,
                            farm.width_m AS farm_width_m,
                            farm.height_m AS farm_height_m
                        FROM real.buildings b
                        JOIN real.farms farm ON farm.id = b.farm_id
                        WHERE b.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND b.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, building_id),
                    )
                    row = cursor.fetchone()
                    if not row:
                        return None

                    clamped_x, clamped_y = self._clamp_position(
                        x_m=x_m,
                        y_m=y_m,
                        width_m=self._to_float(row["width_m"]),
                        height_m=self._to_float(row["height_m"]),
                        farm_width_m=self._to_float(row["farm_width_m"]),
                        farm_height_m=self._to_float(row["farm_height_m"]),
                    )

                    cursor.execute(
                        """
                        UPDATE real.buildings
                        SET x_m = %s, y_m = %s
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (clamped_x, clamped_y, tenant_id, building_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")

                    cursor.execute(
                        """
                        SELECT
                            b.id,
                            b.field_id,
                            b.type,
                            b.width_m,
                            b.height_m,
                            farm.width_m AS farm_width_m,
                            farm.height_m AS farm_height_m
                        FROM sim.buildings b
                        JOIN real.farms farm ON farm.id = b.farm_id
                        WHERE b.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND b.run_id = %s::uuid
                          AND b.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, run_id, building_id),
                    )
                    row = cursor.fetchone()
                    if not row:
                        return None

                    clamped_x, clamped_y = self._clamp_position(
                        x_m=x_m,
                        y_m=y_m,
                        width_m=self._to_float(row["width_m"]),
                        height_m=self._to_float(row["height_m"]),
                        farm_width_m=self._to_float(row["farm_width_m"]),
                        farm_height_m=self._to_float(row["farm_height_m"]),
                    )

                    cursor.execute(
                        """
                        UPDATE sim.buildings
                        SET x_m = %s, y_m = %s
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (clamped_x, clamped_y, tenant_id, run_id, building_id),
                    )

                connection.commit()

        return {
            "id": building_id,
            "field_id": str(row["field_id"]) if row["field_id"] else None,
            "type": row["type"],
            "x_m": clamped_x,
            "y_m": clamped_y,
            "width_m": self._to_float(row["width_m"]),
            "height_m": self._to_float(row["height_m"]),
        }

    def update_field(
        self,
        tenant_id: str,
        field_id: str,
        *,
        label: str,
        crop_type: str,
        x_m: float,
        y_m: float,
        width_m: float,
        height_m: float,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> dict | None:
        if width_m <= 0 or height_m <= 0:
            raise ValueError("Width and height must be positive.")

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        SELECT farm.width_m AS farm_width_m, farm.height_m AS farm_height_m
                        FROM real.fields f
                        JOIN real.farms farm ON farm.id = f.farm_id
                        WHERE f.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND f.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, field_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")
                    cursor.execute(
                        """
                        SELECT farm.width_m AS farm_width_m, farm.height_m AS farm_height_m
                        FROM sim.fields f
                        JOIN real.farms farm ON farm.id = f.farm_id
                        WHERE f.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND f.run_id = %s::uuid
                          AND f.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, run_id, field_id),
                    )

                farm_row = cursor.fetchone()
                if not farm_row:
                    return None

                farm_width = self._to_float(farm_row["farm_width_m"])
                farm_height = self._to_float(farm_row["farm_height_m"])
                if width_m > farm_width or height_m > farm_height:
                    raise ValueError("Field dimensions exceed farm boundaries.")

                clamped_x, clamped_y = self._clamp_position(
                    x_m=x_m,
                    y_m=y_m,
                    width_m=width_m,
                    height_m=height_m,
                    farm_width_m=farm_width,
                    farm_height_m=farm_height,
                )

                if mode == "real":
                    cursor.execute(
                        """
                        UPDATE real.fields
                        SET name = %s,
                            crop_type = %s,
                            x_m = %s,
                            y_m = %s,
                            width_m = %s,
                            height_m = %s
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (label, crop_type, clamped_x, clamped_y, width_m, height_m, tenant_id, field_id),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE sim.fields
                        SET name = %s,
                            crop_type = %s,
                            x_m = %s,
                            y_m = %s,
                            width_m = %s,
                            height_m = %s
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (label, crop_type, clamped_x, clamped_y, width_m, height_m, tenant_id, run_id, field_id),
                    )

                connection.commit()

        return {
            "id": field_id,
            "label": label,
            "crop_type": crop_type,
            "x_m": clamped_x,
            "y_m": clamped_y,
            "width_m": width_m,
            "height_m": height_m,
        }

    def update_building(
        self,
        tenant_id: str,
        building_id: str,
        *,
        building_type: str,
        x_m: float,
        y_m: float,
        width_m: float,
        height_m: float,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> dict | None:
        if width_m <= 0 or height_m <= 0:
            raise ValueError("Width and height must be positive.")

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        SELECT b.field_id, farm.width_m AS farm_width_m, farm.height_m AS farm_height_m
                        FROM real.buildings b
                        JOIN real.farms farm ON farm.id = b.farm_id
                        WHERE b.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND b.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, building_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")
                    cursor.execute(
                        """
                        SELECT b.field_id, farm.width_m AS farm_width_m, farm.height_m AS farm_height_m
                        FROM sim.buildings b
                        JOIN real.farms farm ON farm.id = b.farm_id
                        WHERE b.tenant_id::text = %s
                          AND farm.tenant_id::text = %s
                          AND b.run_id = %s::uuid
                          AND b.id = %s::uuid
                        LIMIT 1
                        """,
                        (tenant_id, tenant_id, run_id, building_id),
                    )

                row = cursor.fetchone()
                if not row:
                    return None

                farm_width = self._to_float(row["farm_width_m"])
                farm_height = self._to_float(row["farm_height_m"])
                if width_m > farm_width or height_m > farm_height:
                    raise ValueError("Building dimensions exceed farm boundaries.")

                clamped_x, clamped_y = self._clamp_position(
                    x_m=x_m,
                    y_m=y_m,
                    width_m=width_m,
                    height_m=height_m,
                    farm_width_m=farm_width,
                    farm_height_m=farm_height,
                )

                if mode == "real":
                    cursor.execute(
                        """
                        UPDATE real.buildings
                        SET type = %s,
                            x_m = %s,
                            y_m = %s,
                            width_m = %s,
                            height_m = %s
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (building_type, clamped_x, clamped_y, width_m, height_m, tenant_id, building_id),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE sim.buildings
                        SET type = %s,
                            x_m = %s,
                            y_m = %s,
                            width_m = %s,
                            height_m = %s
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (building_type, clamped_x, clamped_y, width_m, height_m, tenant_id, run_id, building_id),
                    )

                connection.commit()

        return {
            "id": building_id,
            "field_id": str(row["field_id"]) if row["field_id"] else None,
            "type": building_type,
            "x_m": clamped_x,
            "y_m": clamped_y,
            "width_m": width_m,
            "height_m": height_m,
        }

    def delete_field(
        self,
        tenant_id: str,
        field_id: str,
        *,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> bool:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        DELETE FROM real.fields
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (tenant_id, field_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")
                    cursor.execute(
                        """
                        DELETE FROM sim.fields
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (tenant_id, run_id, field_id),
                    )
                deleted = cursor.rowcount > 0
                connection.commit()
                return deleted

    def delete_building(
        self,
        tenant_id: str,
        building_id: str,
        *,
        mode: InfraMode,
        run_id: str | None = None,
    ) -> bool:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                if mode == "real":
                    cursor.execute(
                        """
                        DELETE FROM real.buildings
                        WHERE tenant_id::text = %s
                          AND id = %s::uuid
                        """,
                        (tenant_id, building_id),
                    )
                else:
                    if not run_id:
                        raise ValueError("runId is required for sim mode.")
                    cursor.execute(
                        """
                        DELETE FROM sim.buildings
                        WHERE tenant_id::text = %s
                          AND run_id = %s::uuid
                          AND id = %s::uuid
                        """,
                        (tenant_id, run_id, building_id),
                    )
                deleted = cursor.rowcount > 0
                connection.commit()
                return deleted

    @staticmethod
    def _clamp_position(
        *,
        x_m: float,
        y_m: float,
        width_m: float,
        height_m: float,
        farm_width_m: float,
        farm_height_m: float,
    ) -> tuple[float, float]:
        max_x = max(0.0, farm_width_m - width_m)
        max_y = max(0.0, farm_height_m - height_m)
        clamped_x = max(0.0, min(x_m, max_x))
        clamped_y = max(0.0, min(y_m, max_y))
        return clamped_x, clamped_y

    @staticmethod
    def _to_float(value: Decimal | float | int) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value)
